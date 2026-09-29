import { Link } from 'react-router-dom'

function NotFound() { return <div className="card section-card"><div className="card-body p-5 text-center"><h1 className="h4 text-dark">Page not found</h1><p className="text-secondary">The page you requested does not exist.</p><Link className="btn btn-primary" to="/">Back to Dashboard</Link></div></div> }

export default NotFound
