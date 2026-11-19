import { useEffect, useState } from "react";
import { LogOut, Minimize2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { invokeTauri, isTauri } from "@/lib/tauri";
import { useSettingsStore, type CloseBehavior } from "@/store/useSettingsStore";
import { useUiStore } from "@/store/useUiStore";
import { useWindowStore } from "@/store/useWindowStore";

/** 点击标题栏关闭按钮时的确认弹窗。 */
export function CloseDialog() {
  const open = useUiStore((state) => state.closeDialogOpen);
  const closeDialog = useUiStore((state) => state.closeCloseDialog);
  const closeBehavior = useSettingsStore((state) => state.closeBehavior);
  const [choice, setChoice] = useState<CloseBehavior>(closeBehavior);

  useEffect(() => {
    if (open) setChoice(closeBehavior);
  }, [open, closeBehavior]);

  if (!open) return null;

  const confirm = async (): Promise<void> => {
    const behavior = choice;
    useSettingsStore.getState().setCloseBehavior(behavior);
    closeDialog();

    if (!isTauri()) return;
    try {
      await invokeTauri("set_close_behavior", { behavior });
      if (behavior === "tray") {
        useWindowStore.getState().hide();
      } else {
        await invokeTauri("exit_app");
      }
    } catch (error) {
      console.warn("[close] 执行关闭操作失败", error);
      useWindowStore.getState().close();
    }
  };

  return (
    <Modal
      title="关闭窗口"
      width={430}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void confirm()}>
            确定
          </button>
        </>
      }
    >
      <p className="modal-text">关闭窗口后要做什么？</p>

      <div className="close-options">
        <label className={`close-option${choice === "exit" ? " active" : ""}`}>
          <input
            type="radio"
            name="close-behavior"
            value="exit"
            checked={choice === "exit"}
            onChange={() => setChoice("exit")}
          />
          <span className="close-option-icon">
            <LogOut size={17} />
          </span>
          <span className="close-option-text">
            <span>退出程序</span>
            <small>结束播放并关闭应用</small>
          </span>
        </label>

        <label className={`close-option${choice === "tray" ? " active" : ""}`}>
          <input
            type="radio"
            name="close-behavior"
            value="tray"
            checked={choice === "tray"}
            onChange={() => setChoice("tray")}
          />
          <span className="close-option-icon">
            <Minimize2 size={17} />
          </span>
          <span className="close-option-text">
            <span>最小化到系统托盘</span>
            <small>隐藏窗口，播放继续</small>
          </span>
        </label>
      </div>
    </Modal>
  );
}
