/**
 * 塞壬唱片接口与本地模型类型。
 *
 * 接口返回的字段名并不统一（artists / artistes、sourceUrl / audioUrl），
 * 这里把「原始响应」与「应用内部模型」分开：原始类型只负责描述接口，
 * 内部模型只暴露渲染需要的字段，避免 UI 直接依赖远端字段名。
 */

export interface ApiEnvelope<T> {
  code: number;
  msg?: string;
  data: T;
}

export interface RawSong {
  cid: string;
  name: string;
  albumCid?: string | null;
  artists?: string[] | null;
  artistes?: string[] | null;
}

export interface RawAlbum {
  cid: string;
  name: string;
  coverUrl?: string | null;
  coverDeUrl?: string | null;
  artistes?: string[] | null;
  intro?: string | null;
  belong?: string | null;
}

export interface RawAlbumDetail extends RawAlbum {
  songs?: RawSong[] | null;
}

export interface RawSongDetail {
  cid: string;
  name: string;
  albumCid?: string | null;
  sourceUrl?: string | null;
  lyricUrl?: string | null;
  mvUrl?: string | null;
  mvCoverUrl?: string | null;
  artists?: string[] | null;
  artistes?: string[] | null;
}

export interface RawSongList {
  list: RawSong[];
}

/** 内部歌曲模型。专辑名 / 封面通过 albumId 关联，避免重复存储。 */
export interface Song {
  id: string;
  name: string;
  artists: string[];
  albumId: string | null;
}

/** 内部专辑模型。songIds 保持接口给出的顺序（也就是专辑曲序）。 */
export interface Album {
  id: string;
  name: string;
  coverUrl: string;
  intro: string;
  artists: string[];
  songIds: string[];
}

/** 播放歌曲需要的一次性详情（音频地址、歌词地址）。 */
export interface SongDetail {
  id: string;
  name: string;
  artists: string[];
  albumId: string | null;
  audioUrl: string;
  lyricUrl: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}
