import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ScenarioContent = {
  id: string;
  title: string;
  description: string;
  track: string;
  level: string;
  language: string;
  estDurationMin: number;
  practiceCallMin: number;
  points: number;
  passMark: number;
  learn: unknown;
  watch: unknown;
};

export const scenariosRepository = {
  getScenario001(): ScenarioContent {
    const path = resolve(__dirname, "../../../../content/scenario-001.json");
    return JSON.parse(readFileSync(path, "utf8")) as ScenarioContent;
  },
};
