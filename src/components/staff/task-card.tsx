type TaskCardProps = {
  title: string;
  description: string;
  count?: number;
  href: string;
};

export function TaskCard({ title, description, count, href }: TaskCardProps) {
  return (
    <a className="task-card" href={href}>
      <span className="task-card-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {typeof count === "number" ? <span className="task-card-count" aria-label={`${count} pendientes`}>{count}</span> : <span className="task-card-arrow" aria-hidden="true">→</span>}
    </a>
  );
}
