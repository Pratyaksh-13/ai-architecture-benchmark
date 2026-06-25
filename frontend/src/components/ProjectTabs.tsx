import { Link, useMatchRoute } from "@tanstack/react-router";

interface ProjectTabsProps {
  id: string;
}

export function ProjectTabs({ id }: ProjectTabsProps) {
  const matchRoute = useMatchRoute();
  const onAnalysis = !!matchRoute({ to: "/projects/$id/analysis", params: { id } });
  const onSummary  = !!matchRoute({ to: "/projects/$id/summary", params: { id } });
  const onOverview = !onAnalysis && !onSummary;

  const activeStyle = {
    backgroundColor: "#2952A3",
    color: "#F2EFE6",
    borderColor: "#2952A3",
  };
  const inactiveStyle = {
    backgroundColor: "transparent",
    color: "#1B2330",
    border: "1px solid #1B2330",
  };
  const base: React.CSSProperties = {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "0.6875rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "0.5rem 1.25rem",
    display: "inline-block",
    textDecoration: "none",
    transition: "background 120ms ease",
  };

  return (
    <div className="flex items-center gap-0 mt-5" style={{ borderBottom: "1px solid var(--hairline)" }}>
      <Link to="/projects/$id" params={{ id }} style={{ ...base, ...(onOverview ? activeStyle : inactiveStyle) }}>
        OVERVIEW
      </Link>
      <Link to="/projects/$id/analysis" params={{ id }} style={{ ...base, ...(onAnalysis ? activeStyle : inactiveStyle), marginLeft: "-1px" }}>
        ANALYSIS
      </Link>
      <Link to="/projects/$id/summary" params={{ id }} style={{ ...base, ...(onSummary ? activeStyle : inactiveStyle), marginLeft: "-1px" }}>
        EXECUTIVE SUMMARY
      </Link>
    </div>
  );
}