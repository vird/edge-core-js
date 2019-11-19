// 

const shown = {}

export function deprecate(name, replacement) {
  if (shown[name]) return
  shown[name] = true

  console.warn(`"${name}" is deprecated. Please use "${replacement}" instead.`)
}
