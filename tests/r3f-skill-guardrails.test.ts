import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

type ViolationCode =
  | 'frame-allocation'
  | 'frame-damp-without-delta'
  | 'frame-state-update'
  | 'lazy-without-suspense'

interface Violation {
  code: ViolationCode
  file: string
  line: number
  message: string
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function isNamedCall(node: ts.CallExpression, name: string) {
  if (ts.isIdentifier(node.expression)) return node.expression.text === name
  return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name
}

function jsxTagName(node: ts.JsxTagNameExpression) {
  return node.getText()
}

function analyzeR3fSource(file: string, source: string): Violation[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const violations: Violation[] = []
  const stateSetters = new Set<string>()
  const lazyComponents = new Set<string>()

  function report(code: ViolationCode, node: ts.Node, message: string) {
    const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed))
    violations.push({ code, file, line: line + 1, message })
  }

  function collectBindings(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node)
      && node.initializer
      && ts.isCallExpression(node.initializer)
      && isNamedCall(node.initializer, 'useState')
      && ts.isArrayBindingPattern(node.name)
    ) {
      const setter = node.name.elements[1]
      if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) {
        stateSetters.add(setter.name.text)
      }
    }

    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && ts.isCallExpression(node.initializer)
      && isNamedCall(node.initializer, 'lazy')
    ) {
      lazyComponents.add(node.name.text)
    }

    ts.forEachChild(node, collectBindings)
  }

  collectBindings(parsed)

  function inspectUseFrame(node: ts.CallExpression) {
    const callback = node.arguments[0]
    if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return

    const deltaParameter = callback.parameters[1]
    const deltaName = deltaParameter && ts.isIdentifier(deltaParameter.name)
      ? deltaParameter.name.text
      : null

    function inspectCallback(child: ts.Node) {
      if (ts.isNewExpression(child)) {
        report('frame-allocation', child, 'Allocate Three.js objects outside useFrame and reuse them.')
      }

      if (ts.isCallExpression(child)) {
        if (ts.isIdentifier(child.expression) && stateSetters.has(child.expression.text)) {
          report('frame-state-update', child, `Do not call ${child.expression.text} inside useFrame.`)
        }

        if (
          ts.isPropertyAccessExpression(child.expression)
          && child.expression.name.text === 'damp'
        ) {
          const lastArgument = child.arguments.at(-1)
          if (!deltaName || !lastArgument || !ts.isIdentifier(lastArgument) || lastArgument.text !== deltaName) {
            report('frame-damp-without-delta', child, 'Pass the useFrame delta parameter to MathUtils.damp.')
          }
        }
      }

      ts.forEachChild(child, inspectCallback)
    }

    inspectCallback(callback.body)
  }

  function hasSuspenseAncestor(node: ts.Node) {
    let parent: ts.Node | undefined = node.parent
    while (parent) {
      if (ts.isJsxElement(parent) && jsxTagName(parent.openingElement.tagName) === 'Suspense') {
        return true
      }
      parent = parent.parent
    }
    return false
  }

  function inspect(node: ts.Node) {
    if (ts.isCallExpression(node) && isNamedCall(node, 'useFrame')) {
      inspectUseFrame(node)
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = jsxTagName(node.tagName)
      if (lazyComponents.has(tagName) && !hasSuspenseAncestor(node)) {
        report('lazy-without-suspense', node, `Wrap lazy component ${tagName} in Suspense.`)
      }
    }

    ts.forEachChild(node, inspect)
  }

  inspect(parsed)
  return violations
}

function analyzeProject() {
  return sourceFiles('src').flatMap((file) =>
    analyzeR3fSource(relative(process.cwd(), file), readFileSync(file, 'utf8')),
  )
}

describe('R3F skill guardrails', () => {
  it('rejects React state writes and object allocation inside useFrame', () => {
    const violations = analyzeR3fSource('bad-scene.tsx', `
      const [progress, setProgress] = useState(0)
      useFrame(() => {
        setProgress(progress + 1)
        const point = new THREE.Vector3()
        mesh.current.position.copy(point)
      })
    `)

    expect(violations.map(({ code }) => code)).toEqual([
      'frame-state-update',
      'frame-allocation',
    ])
  })

  it('requires frame delta when damping transforms', () => {
    const violations = analyzeR3fSource('bad-damping.tsx', `
      useFrame(() => {
        mesh.current.position.x = THREE.MathUtils.damp(mesh.current.position.x, 1, 8, 0.016)
      })
    `)

    expect(violations.map(({ code }) => code)).toEqual(['frame-damp-without-delta'])
  })

  it('accepts delta-driven ref mutation', () => {
    const violations = analyzeR3fSource('good-scene.tsx', `
      useFrame((_, delta) => {
        mesh.current.position.x = THREE.MathUtils.damp(mesh.current.position.x, 1, 8, delta)
      })
    `)

    expect(violations).toEqual([])
  })

  it('keeps CellForge source inside the selected skill guardrails', () => {
    expect(analyzeProject()).toEqual([])
  })
})
