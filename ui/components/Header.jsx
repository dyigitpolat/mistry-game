import { DIRS } from "../constants/grid.js";
import { headerStyles } from "../styles.js";

export default function Header({ room, onRegenerate, currentRoomId, dungeon }) {
  const roomIds = dungeon?.rooms ? Object.keys(dungeon.rooms) : [];
  const roomIndex = currentRoomId ? roomIds.indexOf(currentRoomId) + 1 : 0;
  const roomCount = roomIds.length;

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
        {roomCount > 0 && `${roomIndex} / ${roomCount} rooms`}
        {room && (
          <>
            &nbsp;|&nbsp; FLOOR: {room.floorType.toUpperCase()} &nbsp;|&nbsp; GATES:{" "}
            {DIRS.filter((d) => room.gates[d]).join(" ")}
          </>
        )}
      </span>
    </div>
  );
}
