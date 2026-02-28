import { buttonStyles } from "../styles.js";

export default function PanelBtn({ label, onClick, disabled }) {
  const style = {
    ...buttonStyles.panelBtn.base,
    ...(disabled ? buttonStyles.panelBtn.disabled : buttonStyles.panelBtn.enabled),
  };
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      style={style}
      onMouseEnter={(e) => {
        if (!disabled) e.target.style.background = "#3a3860";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.target.style.background = "#2a2840";
      }}
    >
      {label}
    </button>
  );
}
