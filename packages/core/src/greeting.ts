export interface CreateGreetingInput {
  name: string
}

export function createGreeting({ name }: CreateGreetingInput): string {
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    return "Hello, GoCanopy."
  }

  return `Hello, ${trimmedName}.`
}
