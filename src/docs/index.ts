import swaggerUi from 'swagger-ui-express'
import { Express } from 'express'
import YAML from 'yaml'
import fs from 'fs'
import path from 'path'

/**
 * @function setupSwagger
 * @description Charge et agrège les fichiers de documentation YAML,
 * puis monte l'UI Swagger sur la route /api-docs
 * @param {Express} app - Instance Express
 * @returns {void}
 */
export function setupSwagger(app: Express): void {
// @ts-ignore
  const docsDir = new URL('.', import.meta.url).pathname

  const base = YAML.parse(fs.readFileSync(path.join(docsDir, 'swagger.config.yml'), 'utf8'))
  const authDoc = YAML.parse(fs.readFileSync(path.join(docsDir, 'auth.doc.yml'), 'utf8'))
  const cardDoc = YAML.parse(fs.readFileSync(path.join(docsDir, 'card.doc.yml'), 'utf8'))
  const deckDoc = YAML.parse(fs.readFileSync(path.join(docsDir, 'deck.doc.yml'), 'utf8'))

  const swaggerDoc = {
    ...base,
    paths: {
      ...authDoc.paths,
      ...cardDoc.paths,
      ...deckDoc.paths,
    },
  }

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))
}