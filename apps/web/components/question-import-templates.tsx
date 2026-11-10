
export default function QuestionImportTemplates() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-gray-600">
        Download Import Template:
      </span>

      <a
        href="/api/imports/template?format=xlsx"
        className="inline-flex items-center rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
      >
        ↓ Excel Template
      </a>

      <a
        href="/api/imports/template?format=csv"
        className="inline-flex items-center rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
      >
        ↓ CSV Template
      </a>
    </div>
  );
}
