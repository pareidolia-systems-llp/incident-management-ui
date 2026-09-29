function PageTitle({ title, description, actions }) {
  return <div className="d-sm-flex align-items-start justify-content-between mb-4 gap-3"><div><h1 className="h3 mb-1 text-dark">{title}</h1>{description && <p className="text-secondary mb-0">{description}</p>}</div>{actions && <div className="flex-shrink-0">{actions}</div>}</div>
}

export default PageTitle
