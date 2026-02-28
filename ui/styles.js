export const layoutStyles = {
  root: {
    minHeight: "100vh",
    width: "100%",
    background: "#12101a",
    fontFamily: "'Courier New', monospace",
    color: "#e8e0d0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px",
    boxSizing: "border-box",
  },
  mainArea: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "center",
  },
};

export const initScreenStyles = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  message: {
    fontSize: 16,
    letterSpacing: 1,
    color: "#e8e0d0",
  },
  error: {
    fontSize: 14,
    color: "#e06050",
    maxWidth: 480,
    textAlign: "center",
  },
};

export const headerStyles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    fontSize: 18,
    letterSpacing: 2,
    color: "#ffe088",
    textShadow: "0 0 8px rgba(255,224,136,0.4)",
  },
  generateBtn: {
    background: "#2a2840",
    border: "2px solid #ffe088",
    color: "#ffe088",
    padding: "6px 18px",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
    letterSpacing: 1,
    transition: "background 0.15s",
  },
  roomInfo: {
    fontSize: 11,
    color: "#88809a",
    letterSpacing: 1,
  },
};

export const panelStyles = {
  container: {
    position: "relative",
    border: "2px solid #2a2840",
    borderRadius: 4,
    overflow: "hidden",
  },
  floating: {
    position: "absolute",
    transform: "translate(-50%, -100%)",
    background: "#1e1c2e",
    border: "2px solid #ffe088",
    borderRadius: 6,
    padding: "8px 10px",
    zIndex: 10,
    minWidth: 140,
    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
  },
  title: {
    fontSize: 11,
    color: "#ffe088",
    marginBottom: 6,
    letterSpacing: 1,
    textAlign: "center",
  },
  close: {
    fontSize: 9,
    color: "#666",
    textAlign: "center",
    marginTop: 6,
    cursor: "pointer",
    letterSpacing: 1,
  },
};

export const canvasStyles = {
  block: {
    display: "block",
    cursor: "pointer",
    imageRendering: "pixelated",
  },
};

export const minimapStyles = {
  container: {
    background: "#1a182a",
    border: "2px solid #2a2840",
    borderRadius: 8,
    padding: 10,
    minWidth: 140,
    minHeight: 120,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 10,
    color: "#88809a",
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: "center",
  },
  svg: {
    display: "block",
  },
};

export const legendStyles = {
  container: {
    marginTop: 14,
    fontSize: 10,
    color: "#44405a",
    letterSpacing: 1,
    textAlign: "center",
    maxWidth: 640,
    lineHeight: 1.8,
  },
};

export const buttonStyles = {
  panelBtn: {
    base: {
      borderRadius: 3,
      padding: "3px 10px",
      fontSize: 10,
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: 1,
      transition: "background 0.12s",
    },
    disabled: {
      background: "#222",
      color: "#555",
      border: "1px solid #333",
      cursor: "not-allowed",
    },
    enabled: {
      background: "#2a2840",
      color: "#e8e0d0",
      border: "1px solid #555",
    },
  },
  itemSlot: {
    width: 28,
    height: 28,
    borderRadius: 3,
    cursor: "pointer",
    border: "2px solid rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    transition: "transform 0.1s",
  },
};
