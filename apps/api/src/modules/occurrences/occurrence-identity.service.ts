export type OccurrenceIdentityFields = {
  institution?: string | null;
  examName?: string | null;
  examYear?: number | null;
  postName?: string | null;
  institutionId?: string | null;
  examId?: string | null;
  postId?: string | null;
};

export type OccurrenceIdentityMatch =
  | { kind: 'MATCH'; occurrence: Record<string, any> }
  | { kind: 'ENRICH'; occurrence: Record<string, any> }
  | { kind: 'CREATE' }
  | { kind: 'AMBIGUOUS'; candidates: Record<string, any>[] };

export class OccurrenceIdentityService {
  static normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static sameReference(
    leftId: string | null | undefined,
    rightId: string | null | undefined,
    leftName: string | null | undefined,
    rightName: string | null | undefined,
    allowNameFallback = false,
  ): boolean {
    if (leftId && rightId && leftId === rightId) return true;
    if (leftId && rightId && leftId !== rightId && !allowNameFallback) return false;
    const left = this.normalize(leftName);
    const right = this.normalize(rightName);
    return Boolean(left && right && left === right);
  }

  static sameCore(
    left: OccurrenceIdentityFields,
    right: OccurrenceIdentityFields,
  ): boolean {
    if (!this.sameReference(left.institutionId, right.institutionId, left.institution, right.institution)) {
      return false;
    }
    if (!this.sameReference(left.examId, right.examId, left.examName, right.examName, true)) {
      return false;
    }

    const leftPostId = left.postId || null;
    const rightPostId = right.postId || null;
    const leftPostName = this.normalize(left.postName);
    const rightPostName = this.normalize(right.postName);
    if (leftPostId && rightPostId) return leftPostId === rightPostId;
    if (leftPostId && rightPostId) return leftPostId === rightPostId;
    if (leftPostName && rightPostName) return leftPostName === rightPostName;
    // Missing Post metadata is unknown, not a different Post. classify() rejects multiple candidates.
    return !leftPostId || !rightPostId || !leftPostName || !rightPostName;
  }

  static classify(
    candidates: Record<string, any>[],
    incoming: OccurrenceIdentityFields,
  ): OccurrenceIdentityMatch {
    const sameCore = candidates.filter((candidate) => this.sameCore(candidate, incoming));
    const incomingYear =
      incoming.examYear === undefined || incoming.examYear === null ||
      String(incoming.examYear).trim() === ''
        ? null
        : Number(incoming.examYear);

    if (incomingYear !== null) {
      const sameYear = sameCore.filter((candidate) => candidate.examYear === incomingYear);
      if (sameYear.length === 1) {
        const occurrence = sameYear[0];
        const needsEnrichment = ['institution', 'examName', 'postName', 'institutionId', 'examId', 'postId']
          .some((field) =>
            (occurrence[field] === null || occurrence[field] === undefined || occurrence[field] === '') &&
            incoming[field] !== null && incoming[field] !== undefined && incoming[field] !== '',
          );
        return { kind: needsEnrichment ? 'ENRICH' : 'MATCH', occurrence };
      }
      if (sameYear.length > 1) return { kind: 'AMBIGUOUS', candidates: sameYear };

      const withoutYear = sameCore.filter((candidate) => candidate.examYear === null || candidate.examYear === undefined);
      if (withoutYear.length === 1) return { kind: 'ENRICH', occurrence: withoutYear[0] };
      if (withoutYear.length > 1) return { kind: 'AMBIGUOUS', candidates: withoutYear };
      return { kind: 'CREATE' };
    }

    if (sameCore.length === 1) {
      const occurrence = sameCore[0];
      const needsEnrichment = ['institution', 'examName', 'postName', 'institutionId', 'examId', 'postId']
        .some((field) =>
          (occurrence[field] === null || occurrence[field] === undefined || occurrence[field] === '') &&
          incoming[field] !== null && incoming[field] !== undefined && incoming[field] !== '',
        );
      return { kind: needsEnrichment ? 'ENRICH' : 'MATCH', occurrence };
    }
    if (sameCore.length > 1) return { kind: 'AMBIGUOUS', candidates: sameCore };
    return { kind: 'CREATE' };
  }

  static async findMatch(
    db: any,
    questionId: string,
    incoming: OccurrenceIdentityFields,
    excludeId?: string,
  ): Promise<OccurrenceIdentityMatch> {
    const rows = await db.questionOccurrence.findMany({
      where: { questionId },
      select: {
        id: true, questionId: true, institution: true, examName: true,
        examYear: true, postName: true, institutionId: true, examId: true,
        postId: true, department: true, questionNumber: true, source: true,
        sourcePage: true, sourceUrl: true, sourceDocumentId: true,
        isPrimary: true, updatedAt: true,
      },
    });
    return this.classify(rows.filter((row: Record<string, any>) => row.id !== excludeId), incoming);
  }
}
