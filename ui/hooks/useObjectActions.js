import { useCallback } from "react";

export function useObjectActions({ room, setRoom, setInventory }) {
  const mutateObj = useCallback((objId, fn) => {
    setRoom(prev => ({
      ...prev,
      objects: prev.objects.map(o => (o.id === objId ? { ...o, ...fn(o) } : o)),
    }));
  }, [setRoom]);

  const toggleOpen = useCallback(
    (objId) => {
      if (!room?.objects) return;
      const obj = room.objects.find(o => o.id === objId);
      if (obj?.locked) return;
      mutateObj(objId, o => ({ open: !o.open }));
    },
    [room, mutateObj]
  );

  const toggleLock = useCallback(
    (objId) => {
      if (!room?.objects) return;
      const obj = room.objects.find(o => o.id === objId);
      if (obj?.open) return;
      mutateObj(objId, o => ({ locked: !o.locked }));
    },
    [room, mutateObj]
  );

  const pickUpItem = useCallback(
    (objId, itemId) => {
      if (!room?.objects) return;
      const obj = room.objects.find(o => o.id === objId);
      if (!obj) return;
      const item = obj.items?.find(i => i.id === itemId);
      if (!item) return;
      setInventory(prev => [...prev, item]);
      mutateObj(objId, o => ({ items: o.items.filter(i => i.id !== itemId) }));
    },
    [room, setInventory, mutateObj]
  );

  const pickUpFromSurface = useCallback(
    (objId) => {
      if (!room?.objects) return;
      const obj = room.objects.find(o => o.id === objId);
      if (!obj?.items?.length) return;
      setInventory(prev => [...prev, ...obj.items]);
      mutateObj(objId, () => ({ items: [] }));
    },
    [room, setInventory, mutateObj]
  );

  return {
    mutateObj,
    toggleOpen,
    toggleLock,
    pickUpItem,
    pickUpFromSurface,
  };
}
