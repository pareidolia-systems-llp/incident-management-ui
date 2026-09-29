function ApiState({ type, message, onRetry }) {
  if (type === 'loading') return <div className="py-5 text-center text-secondary"><div className="spinner-border spinner-border-sm me-2" role="status" />Loading incidents…</div>
  if (type === 'error') return <div className="alert alert-danger" role="alert"><div>{message || 'We could not load this information. Please try again.'}</div>{onRetry && <button className="btn btn-sm btn-outline-danger mt-2" onClick={onRetry}>Try again</button>}</div>
  return <div className="py-5 text-center text-secondary">No incidents found.</div>
}

export default ApiState
