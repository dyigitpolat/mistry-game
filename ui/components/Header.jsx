import { DIRS } from "../constants/grid.js";
import { headerStyles } from "../styles.js";

export default function Header({ room, onRegenerate }) {
  return (
    <div style={headerStyles.container}>
      <h1 style={headerStyles.title}>◈ ROOM GENERATOR</h1>
      <button
        onClick={onRegenerate}
        style={headerStyles.generateBtn}
        onMouseEnter={(e) => (e.target.style.background = "#3a3860")}
        onMouseLeave={(e) => (e.target.style.background = "#2a2840")}
      >
        ↻ GENERATE
      </button>
      <span style={headerStyles.roomInfo}>
        FLOOR: {room.floorType.toUpperCase()} &nbsp;|&nbsp; GATES:{" "}
        {DIRS.filter((d) => room.gates[d]).join(" ")}
      </span>
    </div>
  );
}
