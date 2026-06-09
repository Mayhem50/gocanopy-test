#!/usr/bin/env node
import { createGreeting } from "@gocanopy/core"

const name = process.argv.at(2) ?? "GoCanopy"

process.stdout.write(`${createGreeting({ name })}\n`)
