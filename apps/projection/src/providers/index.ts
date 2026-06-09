import { createRuleBasedLabelingService } from "./labeling"
import { createPostgresProjectionStore } from "./projection-store"
import type { ProjectionProviders } from "./types"

export * from "./types"

export function createProjectionProviders(): ProjectionProviders {
  return {
    labelingService: createRuleBasedLabelingService(),
    projectionStore: createPostgresProjectionStore(),
  }
}
