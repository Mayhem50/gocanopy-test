import type { LabelAssignmentSource, LabelStatus } from "@gocanopy/models"

import type {
  LabelDefinition,
  LabelingService,
  MerchantTransactionForLabeling,
} from "./types"

type KeywordRule = {
  keywords: string[]
  labelId: string
  reasonPrefix: string
  source: Exclude<LabelAssignmentSource, "user" | "receipt_item_suggestion">
}

const labelCatalog: LabelDefinition[] = [
  createLabelDefinition("grocery", "Grocery"),
  createLabelDefinition("restaurant", "Restaurant"),
  createLabelDefinition("pharmacy", "Pharmacy"),
  createLabelDefinition("subscription", "Subscription"),
  createLabelDefinition("transport", "Transport"),
  createLabelDefinition("marketplace", "Marketplace"),
]

const keywordRules: KeywordRule[] = [
  {
    keywords: ["spotify", "netflix"],
    labelId: "subscription",
    reasonPrefix: "bank_keyword",
    source: "bank_suggestion",
  },
  {
    keywords: ["boots", "pharmacy"],
    labelId: "pharmacy",
    reasonPrefix: "merchant_keyword",
    source: "rule",
  },
  {
    keywords: ["caffe", "cafe", "nero", "restaurant", "pigs ear", "pig s ear"],
    labelId: "restaurant",
    reasonPrefix: "merchant_keyword",
    source: "rule",
  },
  {
    keywords: ["tesco", "supervalu", "market", "farmers"],
    labelId: "grocery",
    reasonPrefix: "merchant_keyword",
    source: "rule",
  },
  {
    keywords: ["uber", "taxi", "ryanair", "train", "bus"],
    labelId: "transport",
    reasonPrefix: "bank_keyword",
    source: "bank_suggestion",
  },
  {
    keywords: ["amazon", "marketplace", "ebay"],
    labelId: "marketplace",
    reasonPrefix: "merchant_keyword",
    source: "rule",
  },
]

function createLabelDefinition(labelId: string, name: string): LabelDefinition {
  return {
    createdBy: "system",
    labelId,
    name,
    parentId: null,
    status: "active" satisfies LabelStatus,
  }
}

function toSearchTexts(input: MerchantTransactionForLabeling): string[] {
  return [
    input.merchant.displayName,
    ...input.merchant.aliases,
    input.receipt?.merchantName ?? "",
    input.bankTransaction?.descriptionNormalized ?? "",
    input.bankTransaction?.descriptionRaw ?? "",
  ].filter((value) => value.length > 0)
}

function matchRule(rules: KeywordRule[], texts: string[]): KeywordRule | null {
  const normalizedTexts = texts.map((text) => text.toLowerCase())

  for (const rule of rules) {
    const matchedKeyword = rule.keywords.find((keyword) =>
      normalizedTexts.some((text) => text.includes(keyword)),
    )

    if (matchedKeyword) {
      return {
        ...rule,
        keywords: [matchedKeyword],
      }
    }
  }

  return null
}

export function createRuleBasedLabelingService(): LabelingService {
  return {
    listLabels() {
      return labelCatalog
    },
    suggestLabel(input) {
      const texts = toSearchTexts(input)
      const matchedRule = matchRule(keywordRules, texts)

      if (!matchedRule) {
        return null
      }

      return {
        labelId: matchedRule.labelId,
        reason: `${matchedRule.reasonPrefix}:${matchedRule.keywords[0]}`,
        source: matchedRule.source,
      }
    },
  }
}
