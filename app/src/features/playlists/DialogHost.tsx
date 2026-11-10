import { useEffect, useMemo, useState } from "react";
import { ListPlus, Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { usePlaylistsStore } from "@/store/usePlaylistsStore";
import { toast } from "@/store/useToastStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

function CreatePlaylistDialog({ songIds }: { songIds: string[] }) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const navigate = useUiStore((state) => state.navigate);
  const create = usePlaylistsStore((state) => state.create);
  const [name, setName] = useState("");

  const submit = (): void => {
    const playlist = create(name, songIds);
    closeDialog();
    toast(`已创建歌单「${playlist.name}」`, "success");
    if (songIds.length === 0) navigate({ name: "playlist", id: playlist.id });
  };

  return (
    <Modal
      title="新建歌单"
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            创建
          </button>
        </>
      }
    >
      <label className="field">
        <span>歌单名称</span>
        <input
          autoFocus
          value={name}
          placeholder="例如：深夜循环"
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </label>
      {songIds.length > 0 ? <p className="field-hint">将同时加入 {songIds.length} 首歌曲</p> : null}
    </Modal>
  );
}

function RenamePlaylistDialog({ playlistId }: { playlistId: string }) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const playlist = usePlaylistsStore((state) =>
    state.items.find((item) => item.id === playlistId),
  );
  const rename = usePlaylistsStore((state) => state.rename);
  const [name, setName] = useState(playlist?.name ?? "");

  useEffect(() => {
    setName(playlist?.name ?? "");
  }, [playlist?.name]);

  useEffect(() => {
    if (!playlist) closeDialog();
  }, [playlist, closeDialog]);

  if (!playlist) return null;

  const submit = (): void => {
    rename(playlistId, name);
    closeDialog();
  };

  return (
    <Modal
      title="重命名歌单"
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span>歌单名称</span>
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </label>
    </Modal>
  );
}

function DeletePlaylistDialog({ playlistId }: { playlistId: string }) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const navigate = useUiStore((state) => state.navigate);
  const view = useUiStore((state) => state.view);
  const playlist = usePlaylistsStore((state) =>
    state.items.find((item) => item.id === playlistId),
  );
  const remove = usePlaylistsStore((state) => state.remove);

  const confirm = (): void => {
    remove(playlistId);
    closeDialog();
    toast("歌单已删除", "success");
    if (view.name === "playlist" && view.id === playlistId) {
      navigate({ name: "playlists" });
    }
  };

  return (
    <Modal
      title="删除歌单"
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            取消
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm}>
            删除
          </button>
        </>
      }
    >
      <p className="modal-text">
        确定要删除「{playlist?.name ?? "这个歌单"}」吗？歌曲本身不会被删除。
      </p>
    </Modal>
  );
}

function AddToPlaylistDialog({ songIds }: { songIds: string[] }) {
  const closeDialog = useUiStore((state) => state.closeDialog);
  const openDialog = useUiStore((state) => state.openDialog);
  const playlists = usePlaylistsStore((state) => state.items);
  const addSongs = usePlaylistsStore((state) => state.addSongs);
  const songById = useLibraryStore((state) => state.songById);

  const firstSongName = useMemo(() => {
    const first = songIds[0];
    return first ? (songById.get(first)?.name ?? "这首歌曲") : "歌曲";
  }, [songIds, songById]);

  const handleAdd = (playlistId: string, name: string): void => {
    const added = addSongs(playlistId, songIds);
    closeDialog();
    if (added === 0) toast(`「${name}」里已经有这些歌曲了`, "info");
    else toast(`已添加到「${name}」`, "success");
  };

  return (
    <Modal title="添加到歌单" onClose={closeDialog} width={420}>
      <p className="modal-text">
        将 {songIds.length > 1 ? `${songIds.length} 首歌曲` : `「${firstSongName}」`} 加入：
      </p>

      <div className="playlist-picker">
        {playlists.length === 0 ? (
          <p className="field-hint">还没有歌单，先新建一个。</p>
        ) : (
          playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className="playlist-picker-item"
              onClick={() => handleAdd(playlist.id, playlist.name)}
            >
              <ListPlus size={16} />
              <span>{playlist.name}</span>
              <span className="playlist-picker-count">{playlist.songIds.length}</span>
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        className="btn btn-ghost playlist-picker-new"
        onClick={() => openDialog({ type: "create-playlist", songIds })}
      >
        <Plus size={16} />
        新建歌单并加入
      </button>
    </Modal>
  );
}

export function DialogHost() {
  const dialog = useUiStore((state) => state.dialog);
  if (!dialog) return null;

  switch (dialog.type) {
    case "create-playlist":
      return <CreatePlaylistDialog songIds={dialog.songIds} />;
    case "rename-playlist":
      return <RenamePlaylistDialog playlistId={dialog.playlistId} />;
    case "delete-playlist":
      return <DeletePlaylistDialog playlistId={dialog.playlistId} />;
    case "add-to-playlist":
      return <AddToPlaylistDialog songIds={dialog.songIds} />;
    default:
      return null;
  }
}
