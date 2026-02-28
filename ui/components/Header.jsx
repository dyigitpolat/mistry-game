import { DIRS } from "../constants/grid.js";
import { headerStyles } from "../styles.js";

export default function Header({
  room,
  onRefreshWorld,
  onLoadTestWorld,
  currentRoomId,
  dungeon,
  worldLoadPending,
  worldLoadError,
}) {
  const roomIds = dungeon?.rooms ? Object.keys(dungeon.rooms) : [];
  const roomIndex = currentRoomId ? roomIds.indexOf(currentRoomId) + 1 : 0;
  const roomCount = roomIds.length;

  return (
    <div style={headerStyles.container}>
      <h1 style={headerStyles.title}>◈ ROOM GENERATOR</h1>
      {onRefreshWorld && (
        <button
          onClick={onRefreshWorld}
          disabled={worldLoadPending}
          style={headerStyles.generateBtn}
          onMouseEnter={(e) => !e.target.disabled && (e.target.style.background = "#3a3860")}
          onMouseLeave={(e) => (e.target.style.background = "#2a2840")}
        >
          {worldLoadPending ? "… Refreshing" : "↻ REFRESH WORLD"}
        </button>
      )}
      {onLoadTestWorld && (
        <button
          onClick={onLoadTestWorld}
          disabled={worldLoadPending}
          style={{ ...headerStyles.generateBtn, marginLeft: 8 }}
          onMouseEnter={(e) => !e.target.disabled && (e.target.style.background = "#3a3860")}
          onMouseLeave={(e) => (e.target.style.background = "#2a2840")}
        >
          {worldLoadPending ? "… Loading" : "📜 TEST WORLD"}
        </button>
      )}
      {worldLoadError && (
        <span style={{ ...headerStyles.roomInfo, color: "#e88", marginLeft: 8 }}>{worldLoadError}</span>
      )}
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
