import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SearchResult {
  id: string;
  title: string;
  role: string;
  status: string;
  description: string | null;
  fipiCode: string | null;
  rank: number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    // Build a tsquery-compatible string: split words, join with " & "
    // For short queries (<= 2 chars) fall back to ILIKE to avoid tsquery errors
    if (q.length <= 2) {
      return this.ilikeFallback(q, limit);
    }

    try {
      // Use Russian + English language config for stemming
      // Prefix search: append :* so partial words match ("квадра" matches "квадратные")
      const tsQuery = q
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `${w}:*`)
        .join(" & ");

      const rows = await this.prisma.$queryRaw<SearchResult[]>`
        SELECT
          id,
          title,
          role::text,
          status::text,
          description,
          "fipiCode",
          ts_rank(
            to_tsvector('russian', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(content,'')),
            to_tsquery('russian', ${tsQuery})
          ) AS rank
        FROM "KgNodeRegistry"
        WHERE
          to_tsvector('russian', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(content,''))
          @@ to_tsquery('russian', ${tsQuery})
          OR title ILIKE ${"%" + q + "%"}
        ORDER BY rank DESC, title ASC
        LIMIT ${limit}
      `;

      return rows;
    } catch {
      // FTS parse error (e.g. special chars) — fall back to ILIKE
      return this.ilikeFallback(q, limit);
    }
  }

  private async ilikeFallback(q: string, limit: number): Promise<SearchResult[]> {
    const rows = await this.prisma.$queryRaw<SearchResult[]>`
      SELECT
        id,
        title,
        role::text,
        status::text,
        description,
        "fipiCode",
        1.0::float AS rank
      FROM "KgNodeRegistry"
      WHERE title ILIKE ${"%" + q + "%"}
         OR description ILIKE ${"%" + q + "%"}
         OR "fipiCode" ILIKE ${"%" + q + "%"}
      ORDER BY title ASC
      LIMIT ${limit}
    `;
    return rows;
  }
}
