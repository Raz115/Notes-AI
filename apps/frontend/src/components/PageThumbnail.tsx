import { PAGE_DIMENSIONS, isStrokeObject, type CanvasObject, type Page } from "@ai-notes/shared";
import { arrowHeadPoints } from "../canvas/objectGeometry.js";

export function PageThumbnail({ page, objects }: { page: Page; objects: CanvasObject[] }) {
  const { width, height } = PAGE_DIMENSIONS[page.size][page.orientation];
  return (
    <svg className="notebook-thumbnail" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <rect width={width} height={height} fill={page.template === "notepad" ? "#fff7e7" : "#fffefb"} />
      {page.template !== "plain" && Array.from({
        length: page.template === "graph" ? Math.floor((height - 1) / 24) : Math.max(0, Math.ceil((height - 100) / 30)),
      }, (_, index) => (
        <line key={`h${index}`} x1="0" x2={width}
          y1={page.template === "graph" ? (index + 1) * 24 : 80 + index * 30}
          y2={page.template === "graph" ? (index + 1) * 24 : 80 + index * 30}
          stroke="#e7e9ee" strokeWidth="1" />
      ))}
      {page.template === "graph" && Array.from({ length: Math.floor((width - 1) / 24) }, (_, index) => (
        <line key={`v${index}`} y1="0" y2={height} x1={(index + 1) * 24} x2={(index + 1) * 24}
          stroke="#e7e9ee" strokeWidth="1" />
      ))}
      {page.template === "notepad" && <line x1="90" x2="90" y1="0" y2={height} stroke="#fca5a5" strokeWidth="1.5" />}
      {objects.map((object) => {
        if (isStrokeObject(object)) {
          const point = object.points[0];
          if (object.points.length === 1 && point) return <circle key={object.id} cx={point.x} cy={point.y}
            r={object.style.thickness / 2} fill={object.style.color} opacity={object.style.opacity} />;
          return <polyline key={object.id} points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none" stroke={object.style.color} strokeWidth={object.style.thickness}
            strokeOpacity={object.style.opacity} strokeLinecap="round" strokeLinejoin="round" />;
        }
        if (object.type === "textbox") return <foreignObject key={object.id} x={object.x} y={object.y}
          width={object.width} height={object.height}>
          <div style={{ fontSize: object.fontSize, fontFamily: object.font === "serif" ? "serif" : "sans-serif",
            fontWeight: object.bold ? "bold" : "normal", color: object.color, padding: 4, lineHeight: 1.25,
            whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{object.text}</div>
        </foreignObject>;
        if (object.type === "rectangle") return <rect key={object.id} x={object.x} y={object.y}
          width={object.width} height={object.height} fill={object.style.fillColor ?? "none"} stroke={object.style.strokeColor}
          strokeWidth={object.style.strokeWidth} opacity={object.style.opacity} />;
        if (object.type === "ellipse") return <ellipse key={object.id} cx={object.x + object.width / 2}
          cy={object.y + object.height / 2} rx={object.width / 2} ry={object.height / 2}
          fill={object.style.fillColor ?? "none"} stroke={object.style.strokeColor} strokeWidth={object.style.strokeWidth} opacity={object.style.opacity} />;
        if (object.type === "line" || object.type === "arrow") return <g key={object.id}
          fill="none" stroke={object.style.strokeColor} strokeWidth={object.style.strokeWidth} opacity={object.style.opacity}>
          <line x1={object.x1} y1={object.y1} x2={object.x2} y2={object.y2} />
          {object.type === "arrow" && <polyline
            points={arrowHeadPoints(object.x1, object.y1, object.x2, object.y2, object.style.strokeWidth)} />}
        </g>;
        if (object.type === "polygon") return <polygon key={object.id}
          points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill={object.style.fillColor ?? "none"} stroke={object.style.strokeColor} strokeWidth={object.style.strokeWidth} opacity={object.style.opacity} />;
        return null;
      })}
    </svg>
  );
}
