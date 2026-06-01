import { randomUUID } from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { documents, documentChunks } from '../../db/schema.js'
import type { Document, DocumentChunk } from '../../db/schema.js'

export type ChunkInput = {
  chunkIndex: number
  content: string
  embedding: number[]
}

export const knowledgeRepository = {
  // Creează documentul + chunk-urile lui într-o tranzacție: ori intră tot, ori nimic
  // (un document fără chunks ar fi inutil și ar polua lista).
  async create(
    userId: string,
    filename: string,
    mime: string,
    charCount: number,
    chunks: ChunkInput[],
  ): Promise<Document> {
    const now = Date.now()
    const doc: Document = {
      id: randomUUID(),
      userId,
      filename,
      mime,
      charCount,
      status: 'ready',
      createdAt: now,
    }
    await db.transaction(async tx => {
      await tx.insert(documents).values(doc)
      if (chunks.length > 0) {
        await tx.insert(documentChunks).values(chunks.map(c => ({
          id: randomUUID(),
          documentId: doc.id,
          userId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          embedding: c.embedding,
          createdAt: now,
        })))
      }
    })
    return doc
  },

  async list(userId: string): Promise<Document[]> {
    return db.select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))
      .limit(200)
  },

  // Scoped pe userId — împiedică IDOR la ștergere (userul A nu atinge documentul lui B).
  async findById(userId: string, documentId: string): Promise<Document | null> {
    const rows = await db.select()
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.id, documentId)))
    return rows[0] ?? null
  },

  // Chunk-urile cad prin ON DELETE CASCADE.
  async delete(userId: string, documentId: string): Promise<void> {
    await db.delete(documents)
      .where(and(eq(documents.userId, userId), eq(documents.id, documentId)))
  },

  // Toate chunk-urile userului — folosite la retrieval (cosine în cod, scoped pe userId).
  // La scara actuală (câteva documente/business) e instant; pgvector ar fi necesar abia la volum mare.
  async listChunksForUser(userId: string): Promise<DocumentChunk[]> {
    return db.select()
      .from(documentChunks)
      .where(eq(documentChunks.userId, userId))
  },
}
