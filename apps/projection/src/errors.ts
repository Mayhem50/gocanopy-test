import type { ProjectionTargetCode } from "./types"

export class ProjectionTargetNotFoundError extends Error {
  readonly code: ProjectionTargetCode

  constructor(code: ProjectionTargetCode) {
    super(code)
    this.name = "ProjectionTargetNotFoundError"
    this.code = code
  }
}
