import PanelBtn from "./PanelBtn.jsx";
import { panelStyles } from "../styles.js";

export default function InteractionPanel({
  selectedObject,
  panelPos,
  onToggleOpen,
  onClose,
}) {
  if (!selectedObject) return null;

  const isContainer =
    selectedObject.type?.startsWith("container") ||
    (selectedObject.type === "world_object" && selectedObject.category === "container");
  const isSurface =
    selectedObject.type === "surface_table" ||
    (selectedObject.type === "world_object" && selectedObject.category === "surface");

  if (!isContainer && !isSurface) return null;

  const title =
    selectedObject.name ||
    selectedObject.type?.replace("_", " ").toUpperCase() ||
    "OBJECT";

  return (
    <div
      style={{
        ...panelStyles.floating,
        left: panelPos.left,
        top: panelPos.top,
      }}
    >
      <div style={panelStyles.title}>
        {title}
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
            onClick={() => onToggleOpen(selectedObject.id)}
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
              {isContainer ? "CONTENTS" : "ON SURFACE"} — hover item in room for notes
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 4,
                maxHeight: 120,
                overflowY: "auto",
              }}
            >
              {selectedObject.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    fontSize: 10,
                    color: "#ddd6ee",
                    background: "#262239",
                    border: "1px solid #4f4868",
                    borderRadius: 4,
                    padding: "4px 6px",
                  }}
                >
                  {item.name}
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
