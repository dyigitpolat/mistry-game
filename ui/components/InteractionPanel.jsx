import PanelBtn from "./PanelBtn.jsx";
import { panelStyles, buttonStyles } from "../styles.js";

export default function InteractionPanel({
  selectedObject,
  panelPos,
  onOpen,
  onLock,
  onPickUpItem,
  onPickUpFromSurface,
  onClose,
}) {
  if (!selectedObject) return null;

  const isContainer = selectedObject.type?.startsWith("container");
  const isSurface = selectedObject.type === "surface_table";

  if (!isContainer && !isSurface) return null;

  return (
    <div
      style={{
        ...panelStyles.floating,
        left: panelPos.left,
        top: panelPos.top,
      }}
    >
      <div style={panelStyles.title}>
        {selectedObject.type.replace("_", " ").toUpperCase()}
      </div>
      {isContainer && (
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 6,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <PanelBtn
            label={selectedObject.open ? "Close" : "Open"}
            disabled={selectedObject.locked}
            onClick={() => onOpen(selectedObject.id)}
          />
          <PanelBtn
            label={selectedObject.locked ? "Unlock" : "Lock"}
            disabled={selectedObject.open}
            onClick={() => onLock(selectedObject.id)}
          />
        </div>
      )}
      {((isContainer && selectedObject.open) || isSurface) &&
        selectedObject.items?.length > 0 && (
          <div style={{ borderTop: "1px solid #333", paddingTop: 6 }}>
            <div
              style={{
                fontSize: 9,
                color: "#88809a",
                marginBottom: 4,
                textAlign: "center",
              }}
            >
              {isContainer ? "CONTENTS" : "ON SURFACE"} — click to pick up
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {selectedObject.items.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickUpItem(selectedObject.id, item.id);
                  }}
                  title={item.name}
                  style={{
                    ...buttonStyles.itemSlot,
                    background: item.color,
                  }}
                  onMouseEnter={(e) => (e.target.style.transform = "scale(1.2)")}
                  onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
                >
                  {item.name[0]}
                </div>
              ))}
            </div>
          </div>
        )}
      {isContainer &&
        selectedObject.open &&
        selectedObject.items?.length === 0 && (
          <div
            style={{
              fontSize: 9,
              color: "#555",
              textAlign: "center",
              paddingTop: 4,
            }}
          >
            Empty
          </div>
        )}
      {isSurface && selectedObject.items?.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <PanelBtn
            label="Pick Up All"
            onClick={() => onPickUpFromSurface(selectedObject.id)}
          />
        </div>
      )}
      {isSurface && selectedObject.items?.length === 0 && (
        <div style={{ fontSize: 9, color: "#555", textAlign: "center" }}>
          Nothing here
        </div>
      )}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={panelStyles.close}
      >
        ✕ close
      </div>
    </div>
  );
}
