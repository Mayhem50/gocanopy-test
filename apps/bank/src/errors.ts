export class BankStatementRejectedError extends Error {
  readonly errors: string[]

  constructor(errors: string[]) {
    super("bank_statement_rejected")
    this.name = "BankStatementRejectedError"
    this.errors = errors
  }
}
