import { legendStyles } from "../styles.js";

export default function Legend() {
  return (
    <div style={legendStyles.container}>
      CLICK floor to move &nbsp;•&nbsp; CLICK containers/tables to interact
      &nbsp;•&nbsp; LOCKED containers must be unlocked before opening &nbsp;•&nbsp;{" "}
      ITEMS can be picked up to inventory
    </div>
  );
}
