import PanelBtn from "./PanelBtn.jsx";
import { panelStyles } from "./styles.js";

export default function InteractionPanel({
  selectedObject,
  panelPos,
  onToggleOpen,
  onTakeItem,
  getWorldImage,
  onClose,
}) {
  if (!selectedObject) return null;

  const isContainer =
    selectedObject.type?.startsWith("container") ||
    (selectedObject.type === "world_object" && selectedObject.category === "container");
  const isSurface =
    selectedObject.type === "surface_table" ||
    (selectedObject.type === "world_object" && selectedObject.category === "surface");
  const isPerson = selectedObject.type === "world_person";

  if (!isContainer && !isSurface && !isPerson) return null;

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
        transform: panelPos.anchor === "below" ? "translateX(-50%)" : "translate(-50%, -100%)",
      }}
    >
      <div style={panelStyles.title}>
        {title}
      </div>

      {isPerson && (
        <div>
          {selectedObject.state && (
            <div style={{
              fontSize: 9,
              color: selectedObject.state === "dead" ? "#e06050" : "#8bc48b",
              textAlign: "center",
              marginBottom: 4,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}>
              {selectedObject.state}
            </div>
          )}
          {selectedObject.description && (
            <div style={{ fontSize: 10, color: "#d5d0e3", lineHeight: 1.4, marginBottom: 4 }}>
              {selectedObject.description}
            </div>
          )}
          {selectedObject.notes && (
            <div style={{ fontSize: 10, color: "#a8a1ba", lineHeight: 1.35, fontStyle: "italic", borderTop: "1px solid #333", paddingTop: 5 }}>
              {selectedObject.notes}
            </div>
          )}
        </div>
      )}

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
              {selectedObject.items.map((item) => {
                const thumb = item.worldItemSvgKey ? getWorldImage?.(item.worldItemSvgKey) : null;
                const hasThumb = !!(thumb && thumb.complete && thumb.naturalWidth > 0 && thumb.src);
                return (
                  <div
                    key={item.id}
                    style={{
                      fontSize: 10,
                      color: "#ddd6ee",
                      background: "#262239",
                      border: "1px solid #4f4868",
                      borderRadius: 4,
                      padding: "4px 6px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {hasThumb ? (
                      <img
                        src={thumb.src}
                        alt={item.name}
                        style={{
                          width: 20,
                          height: 20,
                          objectFit: "contain",
                          borderRadius: 3,
                          background: "#171326",
                          border: "1px solid #5b5375",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 3,
                          background: item.color ?? "#8a7355",
                          border: "1px solid rgba(255,255,255,0.25)",
                        }}
                      />
                    )}
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {onTakeItem && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTakeItem(item.name ?? item.id);
                        }}
                        style={{
                          fontSize: 9,
                          color: "#ffe088",
                          background: "rgba(255,224,136,0.12)",
                          border: "1px solid rgba(255,224,136,0.3)",
                          borderRadius: 3,
                          padding: "2px 8px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          letterSpacing: 0.5,
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}
                      >
                        Take
                      </button>
                    )}
                  </div>
                );
              })}
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
