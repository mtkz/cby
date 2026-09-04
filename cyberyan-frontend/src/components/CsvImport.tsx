import { useRef } from 'react'
import { useUploadStore } from '../stores/uploadStore'
import type { InvalidRow } from '../types/profile'

function InvalidRowsTable({ rows }: { rows: InvalidRow[] }) {
  return (
    <table className="upload-invalid">
      <thead>
        <tr>
          <th>CSV row</th>
          <th>Problem</th>
          <th>Content preview</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.row}-${i}`}>
            <td>{r.row}</td>
            <td>{r.reason}</td>
            <td className="preview">{r.preview}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function CsvImport() {
  const file = useUploadStore((s) => s.file)
  const busy = useUploadStore((s) => s.busy)
  const error = useUploadStore((s) => s.error)
  const result = useUploadStore((s) => s.result)
  const showAllInvalid = useUploadStore((s) => s.showAllInvalid)
  const selectFile = useUploadStore((s) => s.selectFile)
  const setShowAllInvalid = useUploadStore((s) => s.setShowAllInvalid)
  const upload = useUploadStore((s) => s.upload)
  const reset = useUploadStore((s) => s.reset)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleReset() {
    reset()
    if (inputRef.current) inputRef.current.value = ''
  }

  const invalidRows = result?.invalidRows ?? []
  const visibleRows = showAllInvalid ? invalidRows : invalidRows.slice(0, 5)

  return (
    <section className="panel">
      <h2>Import CSV</h2>
      <p className="hint">
        Upload a CSV of LinkedIn profiles (comma-separated, header row
        required). Corrupt rows are skipped and reported — they do not block
        the good ones.
      </p>

      <div className="upload-row">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          disabled={busy}
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => void upload()}
          disabled={!file || busy}
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={handleReset}
          disabled={busy}
        >
          Reset
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {result && (
        <div
          className={`alert ${result.failed || result.invalidCount ? 'warn' : 'ok'}`}
        >
          <strong>{result.message}</strong>
          <ul className="stats">
            <li>
              Stored in MongoDB: <b>{result.stored}</b>
            </li>
            <li>
              Indexed (Elasticsearch): <b>{result.indexed}</b>
            </li>
            <li>
              Failed (mapping errors): <b>{result.failed}</b>
            </li>
            <li>
              Corrupt rows skipped: <b>{result.invalidCount}</b>
            </li>
            <li>
              Rows repaired (bad field dropped): <b>{result.repairedCount}</b>
            </li>
          </ul>
          {result.errors.length > 0 && (
            <>
              <div className="subhead">Elasticsearch errors</div>
              <ul className="errors">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <span className="count">×{e.count}</span> {e.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          {invalidRows.length > 0 && (
            <>
              <div className="subhead">
                Skipped rows{' '}
                {invalidRows.length > 5 && !showAllInvalid && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => setShowAllInvalid(true)}
                  >
                    show all {invalidRows.length}
                  </button>
                )}
              </div>
              <InvalidRowsTable rows={visibleRows} />
            </>
          )}
        </div>
      )}
    </section>
  )
}