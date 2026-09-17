import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import ClosedCaptionRoundedIcon from "@mui/icons-material/ClosedCaptionRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import SmartDisplayRoundedIcon from "@mui/icons-material/SmartDisplayRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import VideoLibraryRoundedIcon from "@mui/icons-material/VideoLibraryRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Slider,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { DraggableData, DraggableEvent } from "react-draggable";
import Draggable from "react-draggable";
import { Link as RouterLink } from "react-router-dom";

import ClosableAlert from "../components/closable_alert";
import CourseSelect from "../components/course_select";
import FileAIChatModal, {
  FileAIChatMessage,
} from "../components/file_ai_chat_modal";
import BasicLayout from "../components/layout";
import PPTDownloadTable from "../components/ppt_download_table";
import VideoAggregator from "../components/video_aggregator";
import VideoDownloadTable from "../components/video_download_table";
import { WorkspaceHero } from "../components/workspace_hero";
import videoStyles from "../css/video_player.module.css";
import { getConfig } from "../lib/config";
import { VIDEO_PAGE_HINT_ALERT_KEY } from "../lib/constants";
import { useCourses, useSelectedCourse, useAutoLoadCourse } from "../lib/hooks";
import { useAppMessage } from "../lib/message";
import { useTauriEvent } from "../lib/events";
import {
  CanvasVideo,
  DownloadTask,
  LLMChatMessage,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_INFO,
  VideoDownloadTask,
  VideoInfo,
  VideoPlayInfo,
} from "../lib/model";
import { consoleLog, srtToVtt } from "../lib/utils";

import { surfaceCardSx } from "../lib/styles";

function timestampToSeconds(timestamp: string): number {
  const match = timestamp.match(/^\[(\d{2}):(\d{2}):(\d{2}),(\d{1,3})\]$/);
  if (!match) {
    return 0;
  }

  const [, hh, mm, ss] = match;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

function isSubtitleUnavailableError(error: unknown): boolean {
  return String(error).includes("Subtitle unavailable");
}

function isVideoUnavailableError(error: unknown): boolean {
  return String(error).includes("No playable video source");
}

export default function VideoPage() {
  const [videoDownloadTasks, setVideoDownloadTasks] = useState<VideoDownloadTask[]>([]);
  const [pptDownloadTasks, setPPTDownloadTasks] = useState<DownloadTask[]>([]);
  const [operating, setOperating] = useState(false);
  const courses = useCourses();
  const [messageApi, contextHolder] = useAppMessage();
  const [plays, setPlays] = useState<VideoPlayInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<CanvasVideo | undefined>();
  const { selectedCourseId, setSelectedCourseId } = useSelectedCourse();
  const [videos, setVideos] = useState<CanvasVideo[]>([]);
  const [notLogin, setNotLogin] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [playURLs, setPlayURLs] = useState<string[]>([]);
  const [mainPlayURL, setMainPlayURL] = useState("");
  const [mutedPlayURL, setMutedPlayURL] = useState("");
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [syncPlay, setSyncPlay] = useState(true);
  const [subVideoSize, setSubVideoSize] = useState<number>(25);
  const [subVideoOpacity, setSubVideoOpacity] = useState(0.8);
  const [subVideoPos, setSubVideoPos] = useState({ x: 100, y: 100 });
  const [subtitleUrl, setSubtitleUrl] = useState<string | undefined>(undefined);
  const [summaryChatOpen, setSummaryChatOpen] = useState(false);
  const [summaryChatTitle, setSummaryChatTitle] = useState("");
  const [summaryChatCourseId, setSummaryChatCourseId] = useState<number | null>(null);
  const [summaryChatMessages, setSummaryChatMessages] = useState<FileAIChatMessage[]>([]);
  const [summaryChatLoading, setSummaryChatLoading] = useState(false);
  const [showLoginRequiredDialog, setShowLoginRequiredDialog] = useState(false);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const subVideoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const firstPlay = useRef(true);
  const activeSummaryRequestIdRef = useRef<string | null>(null);

  const LinkRenderer = (props: any) => (
    <a
      target="_blank"
      rel="noreferrer"
      onClick={() => handleMainVideoJump(timestampToSeconds(props.children))}
    >
      {props.children}
    </a>
  );

  const createConversationMessage = (
    role: "user" | "assistant",
    content: string,
    extras?: Partial<FileAIChatMessage>
  ): FileAIChatMessage => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extras,
  });

  const toLLMChatMessages = (messages: FileAIChatMessage[]): LLMChatMessage[] =>
    messages
      .filter((message) => !message.pending)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

  const handleLoginWebsite = async () => {
    try {
      await invoke("login_canvas_website");
      return true;
    } catch (error) {
      consoleLog(LOG_LEVEL_ERROR, error);
      return false;
    }
  };

  useEffect(() => {
    void loginAndCheck();
    return () => {
      if (!firstPlay.current) {
        void invoke("stop_proxy");
      }
    };
  }, []);

  useEffect(() => {
    if (loaded && notLogin) {
      setShowLoginRequiredDialog(true);
    }
  }, [loaded, notLogin]);

  useTauriEvent("video_ai_chat://chunk", (payload) => {
    if (payload.request_id !== activeSummaryRequestIdRef.current) {
      return;
    }
    setSummaryChatMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant") {
          next[i] = {
            ...next[i],
            content: `${next[i].content}${payload.chunk}`,
          };
          break;
        }
      }
      return next;
    });
  });

  useTauriEvent("video_ai_chat://done", (payload) => {
    if (payload.request_id !== activeSummaryRequestIdRef.current) {
      return;
    }
    activeSummaryRequestIdRef.current = null;
    setSummaryChatLoading(false);
    setSummaryChatMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant") {
          next[i] = {
            ...next[i],
            content: payload.content || next[i].content,
            pending: false,
          };
          break;
        }
      }
      return next;
    });
  });

  useTauriEvent("video_ai_chat://error", (payload) => {
    if (payload.request_id !== activeSummaryRequestIdRef.current) {
      return;
    }
    activeSummaryRequestIdRef.current = null;
    setSummaryChatLoading(false);
    messageApi.error(`AI 总结时发生错误：${payload.error}`);
    setSummaryChatMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant") {
          next[i] = {
            ...next[i],
            content: next[i].content || `AI 总结时发生错误：${payload.error}`,
            pending: false,
            error: true,
          };
          break;
        }
      }
      return next;
    });
  });

  const loginAndCheck = async (retry = false) => {
    const success = await handleLoginWebsite();
    if (success && !retry) {
      messageApi.success("检测到登录会话，登录成功", 0.5);
    } else if (success) {
      messageApi.success("登录成功", 0.5);
    }
    setNotLogin(!success);
    setLoaded(true);
    return success;
  };

  const handleSelectCourse = async (selected: number) => {
    setOperating(true);
    setSelectedCourseId(selected);
    setVideos([]);
    setSelectedVideo(undefined);
    setPlayURLs([]);
    setPlays([]);
    setMainPlayURL("");
    setMutedPlayURL("");
    await handleGetVideos(selected);
    setOperating(false);
  };

  useAutoLoadCourse(
    (courseId) => void handleSelectCourse(courseId),
    courses.data.length > 0
  );

  const handleGetVideoInfo = async (video: CanvasVideo) => {
    if (!video.playable) {
      messageApi.info(`该录像${video.availabilityLabel}，暂时无法播放`);
      return;
    }
    try {
      const videoInfo = (await invoke("get_canvas_video_info", {
        videoId: video.videoId,
      })) as VideoInfo;
      const nextPlays = videoInfo.videoPlayResponseVoList;
      nextPlays.forEach((play, index) => {
        play.key = play.id;
        play.index = index;
        const part = index === 0 ? "" : `_录屏`;
        const suffix = index > 2 ? `_${index}.mp4` : ".mp4";
        play.name = `${video.videoName}${part}${suffix}`;
      });
      setPlays(nextPlays);
    } catch (error) {
      if (isVideoUnavailableError(error)) {
        messageApi.info("该录像暂时没有可播放的视频源");
      } else {
        messageApi.error(`获取视频信息时出现错误：${error}`);
      }
    }
  };

  const handleSelectVideo = async (selected: string) => {
    const video = videos.find((item) => item.videoId === selected);
    if (video) {
      setPlays([]);
      setPlayURLs([]);
      setMainPlayURL("");
      setMutedPlayURL("");
      setSelectedVideo(video);
      await handleGetVideoInfo(video);
    }
  };

  const handleGetVideos = async (courseId: number) => {
    try {
      const nextVideos = (await invoke("get_canvas_videos", {
        courseId,
      })) as CanvasVideo[];
      setVideos(nextVideos);
    } catch (error) {
      messageApi.error(`获取录像时发生了错误：${error}`);
    }
  };

  const handleDownloadVideo = (video: VideoPlayInfo) => {
    const videoId = `${video.id}`;
    if (!videoDownloadTasks.find((task) => task.key === videoId)) {
      setVideoDownloadTasks((tasks) => [
        ...tasks,
        {
          key: videoId,
          video,
          video_name: video.name,
          progress: 0,
          state: "downloading",
        } as VideoDownloadTask,
      ]);
    } else {
      messageApi.warning("请勿重复添加任务");
    }
  };

  const handleDownloadSubtitle = async () => {
    if (!selectedVideo) {
      messageApi.warning("请先选择一个视频");
      return;
    }
    try {
      const outputPath = await save({
        defaultPath: `${selectedVideo.videoName}.srt`,
        filters: [{ name: "Subtitle", extensions: ["srt"] }],
      });
      if (!outputPath) {
        return;
      }
      const videoInfo = (await invoke("get_canvas_video_info", {
        videoId: selectedVideo.videoId,
      })) as VideoInfo;
      await invoke("download_subtitle", {
        canvasCourseId: videoInfo.courId,
        savePath: outputPath,
      });
      messageApi.success("字幕下载成功", 0.5);
    } catch (error) {
      if (isSubtitleUnavailableError(error)) {
        messageApi.info("该录像暂无字幕，无法下载");
      } else {
        messageApi.error(`下载字幕时发生错误：${error}`);
      }
    }
  };

  const handleSummarizeSubtitle = async () => {
    if (!selectedVideo) {
      messageApi.warning("请先选择一个视频");
      return;
    }
    try {
      const videoInfo = (await invoke("get_canvas_video_info", {
        videoId: selectedVideo.videoId,
      })) as VideoInfo;
      const openingUserMessage = createConversationMessage(
        "user",
        "请先总结这节课的核心内容。重点关注课程活动与通知、作业/小测/考试/签到提醒，以及主要知识点与框架；如果合适，请引用对应的字幕时间点。"
      );
      const pendingAssistantMessage = createConversationMessage("assistant", "", {
        pending: true,
      });

      setSummaryChatTitle(selectedVideo.videoName);
      setSummaryChatCourseId(videoInfo.courId);
      setSummaryChatOpen(true);
      setSummaryChatLoading(true);
      setSummaryChatMessages([openingUserMessage, pendingAssistantMessage]);

      const requestId = crypto.randomUUID();
      activeSummaryRequestIdRef.current = requestId;
      await invoke("start_subtitle_chat_stream", {
        requestId,
        canvasCourseId: videoInfo.courId,
        messages: toLLMChatMessages([openingUserMessage]),
      });
    } catch (error) {
      activeSummaryRequestIdRef.current = null;
      setSummaryChatLoading(false);
      if (isSubtitleUnavailableError(error)) {
        setSummaryChatOpen(false);
        messageApi.info("该录像暂无字幕，暂时无法进行 AI 总结");
      } else {
        messageApi.error(`AI 总结时发生错误：${error}`);
      }
    }
  };

  const handleSendSummaryMessage = async (content: string) => {
    if (!summaryChatCourseId || summaryChatLoading) {
      return;
    }

    const userMessage = createConversationMessage("user", content);
    const pendingAssistantMessage = createConversationMessage("assistant", "", {
      pending: true,
    });
    const nextMessages = [...summaryChatMessages, userMessage];

    setSummaryChatLoading(true);
    setSummaryChatMessages([...nextMessages, pendingAssistantMessage]);

    try {
      const requestId = crypto.randomUUID();
      activeSummaryRequestIdRef.current = requestId;
      await invoke("start_subtitle_chat_stream", {
        requestId,
        canvasCourseId: summaryChatCourseId,
        messages: toLLMChatMessages(nextMessages),
      });
    } catch (error) {
      activeSummaryRequestIdRef.current = null;
      setSummaryChatLoading(false);
      messageApi.error(`继续对话时发生错误：${error}`);
      setSummaryChatMessages([
        ...nextMessages,
        {
          ...pendingAssistantMessage,
          content: `继续对话时发生错误：${error}`,
          pending: false,
          error: true,
        },
      ]);
    }
  };

  const handleDownloadPPT = async (videoId: string, saveName: string) => {
    const videoInfo = (await invoke("get_canvas_video_info", { videoId })) as VideoInfo;
    const courseId = videoInfo.courId;
    const outputPath = await save({
      defaultPath: saveName,
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
    });
    if (!outputPath) {
      return;
    }

    const displayName = outputPath.split(/[/\\\\]/).pop() || saveName;
    const taskKey = `ppt_${outputPath}`;

    if (!pptDownloadTasks.find((task) => task.key === taskKey)) {
      setPPTDownloadTasks((tasks) => [
        ...tasks,
        {
          key: taskKey,
          name: displayName,
          outputPath,
          progress: 0,
          state: "downloading",
        } as DownloadTask,
      ]);

      void invoke("download_ppt", { courseId, savePath: outputPath })
        .then(() => {
          setPPTDownloadTasks((tasks) =>
            tasks.map((task) =>
              task.key === taskKey
                ? { ...task, state: "completed", progress: 100 }
                : task
            )
          );
          messageApi.success("PPT 下载成功", 0.5);
        })
        .catch((error) => {
          setPPTDownloadTasks((tasks) =>
            tasks.map((task) =>
              task.key === taskKey ? { ...task, state: "fail" } : task
            )
          );
          messageApi.error(`下载 PPT 时发生错误：${error}`);
        });
    } else {
      messageApi.warning("请勿重复添加任务");
    }
  };

  const handleRemoveTask = async (taskToRemove: VideoDownloadTask) => {
    setVideoDownloadTasks((tasks) =>
      tasks.filter((task) => task.key !== taskToRemove.key)
    );
    try {
      await invoke("delete_file_with_name", { name: taskToRemove.video.name });
    } catch (error) {
      if (taskToRemove.state !== "fail") {
        messageApi.error(error as string);
      }
    }
  };

  const handleRemovePPTTask = async (taskToRemove: DownloadTask) => {
    setPPTDownloadTasks((tasks) =>
      tasks.filter((task) => task.key !== taskToRemove.key)
    );
    try {
      if (taskToRemove.outputPath) {
        await invoke("delete_path_file", { path: taskToRemove.outputPath });
      } else {
        await invoke("delete_file_with_name", { name: taskToRemove.name });
      }
    } catch (error) {
      if (taskToRemove.state !== "fail") {
        messageApi.error(error as string);
      }
    }
  };

  const getVidePlayURL = (play: VideoPlayInfo, proxyPort: number) =>
    play.rtmpUrlHdv
      .replace(
        "https://videos.sjtu.edu.cn/vod",
        `http://localhost:${proxyPort}/canvas-vod`
      )
      .replace(
        "https://live.sjtu.edu.cn",
        `http://localhost:${proxyPort}`
      );

  const checkOrStartProxy = async (): Promise<boolean> => {
    const showPreparing = firstPlay.current;
    if (showPreparing) {
      messageApi.open({
        key: "proxy_preparing",
        type: "loading",
        content: "正在启动反向代理...",
        duration: 0,
      });
    }

    try {
      const succeed = (await invoke("prepare_proxy")) as boolean;
      if (succeed) {
        messageApi.destroy("proxy_preparing");
        if (showPreparing) {
          messageApi.success("反向代理启动成功", 0.5);
        }
        firstPlay.current = false;
        return true;
      }
      messageApi.destroy("proxy_preparing");
      messageApi.error("反向代理启动超时，已取消播放");
    } catch (error) {
      messageApi.destroy("proxy_preparing");
      messageApi.error(`反向代理启动失败：${error}`);
    }
    firstPlay.current = true;
    await invoke("stop_proxy").catch(() => undefined);
    return false;
  };

  const probeVideoSource = async (playURL: string): Promise<boolean> => {
    try {
      const response = await fetch(playURL, {
        cache: "no-store",
        headers: { Range: "bytes=0-1" },
      });
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      await response.body?.cancel();

      if (!response.ok) {
        consoleLog(LOG_LEVEL_ERROR, "Video proxy probe failed", {
          status: response.status,
          contentType: contentType || "<missing>",
        });
        messageApi.error(`视频代理返回异常状态（HTTP ${response.status}），已取消播放`);
        return false;
      }

      const looksLikeVideo =
        !contentType ||
        contentType.startsWith("video/") ||
        contentType.includes("mp4") ||
        contentType.includes("octet-stream");
      if (!looksLikeVideo) {
        consoleLog(LOG_LEVEL_ERROR, "Video proxy returned non-video content", {
          status: response.status,
          contentType,
        });
        messageApi.error(`视频代理返回了非视频内容（${contentType}），已取消播放`);
        return false;
      }

      consoleLog(LOG_LEVEL_INFO, "Video proxy probe succeeded", {
        status: response.status,
        contentType: contentType || "<missing>",
      });
      return true;
    } catch (error) {
      consoleLog(LOG_LEVEL_ERROR, "Video proxy probe could not reach local proxy", {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      messageApi.error("WebView 无法访问本地视频代理，已取消播放；请重启应用后重试");
      return false;
    }
  };

  const handlePlay = async (play: VideoPlayInfo) => {
    const config = await getConfig();
    const playURL = getVidePlayURL(play, config.proxy_port);
    if (playURL === mainPlayURL || playURL === mutedPlayURL) {
      messageApi.warning("已经在播放啦");
      return;
    }
    if (mainPlayURL && mutedPlayURL) {
      messageApi.error("目前只支持双屏观看");
      return;
    }
    if (!(await checkOrStartProxy())) {
      return;
    }
    if (!(await probeVideoSource(playURL))) {
      return;
    }

    if (!mainPlayURL) {
      setPlaybackError("");
      setPlaybackLoading(true);
      setMainPlayURL(playURL);
      setMutedPlayURL("");
      setPlayURLs([playURL]);
      return;
    }

    if (!mutedPlayURL) {
      if (play.index === 0) {
        setPlaybackError("");
        setPlaybackLoading(true);
        setMutedPlayURL(mainPlayURL);
        setMainPlayURL(playURL);
        setPlayURLs([playURL, mainPlayURL]);
      } else {
        setMutedPlayURL(playURL);
        setPlayURLs([mainPlayURL, playURL]);
      }
      return;
    }

    if (play.index !== 0 || playURL !== mainPlayURL) {
      setMutedPlayURL(playURL);
    }
    setPlayURLs((urls) => [...urls, playURL]);
  };

  const describeMediaError = (mediaError: MediaError | null) => {
    switch (mediaError?.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return "视频加载被中止";
      case MediaError.MEDIA_ERR_NETWORK:
        return "视频代理或网络请求失败";
      case MediaError.MEDIA_ERR_DECODE:
        return "视频解码失败";
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return "当前视频地址或媒体格式不受支持";
      default:
        return "视频加载失败";
    }
  };

  const handleMainVideoError = () => {
    const player = mainVideoRef.current;
    const detail = describeMediaError(player?.error ?? null);
    let sourceMetadata: Record<string, unknown>;
    try {
      const source = new URL(player?.currentSrc || mainPlayURL);
      sourceMetadata = {
        present: true,
        protocol: source.protocol,
        hostname: source.hostname,
        port: source.port,
        isMp4Path: source.pathname.toLowerCase().endsWith(".mp4"),
        hasQuery: source.search.length > 0,
      };
    } catch {
      sourceMetadata = { present: Boolean(player?.currentSrc || mainPlayURL), valid: false };
    }
    setPlaybackLoading(false);
    setPlaybackError(detail);
    consoleLog(LOG_LEVEL_ERROR, "Video player error", detail, sourceMetadata);
  };

  const tryStartMainVideo = async () => {
    const player = mainVideoRef.current;
    if (!player) return;
    setPlaybackLoading(false);
    try {
      await player.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      // Chromium may still require a direct click on the native control when
      // autoplay with sound is blocked. The media itself remains loaded.
      consoleLog(LOG_LEVEL_ERROR, "Video autoplay was blocked", error);
      setPlaybackError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "视频已加载，请点击播放器中央的播放按钮开始播放。"
          : "视频已加载，但自动播放失败，请使用播放器控件重试。"
      );
    }
  };

  const handleSwapVideo = () => {
    if (playURLs.length === 2 && mainPlayURL && mutedPlayURL) {
      const mainVideo = mainVideoRef.current;
      const subVideo = subVideoRef.current;
      if (!mainVideo || !subVideo) {
        return;
      }

      const mainState = {
        currentTime: mainVideo.currentTime,
        paused: mainVideo.paused,
        playbackRate: mainVideo.playbackRate,
      };
      const subState = {
        currentTime: subVideo.currentTime,
        paused: subVideo.paused,
        playbackRate: subVideo.playbackRate,
      };

      setMainPlayURL(mutedPlayURL);
      setMutedPlayURL(mainPlayURL);

      setTimeout(() => {
        const newMain = mainVideoRef.current;
        const newSub = subVideoRef.current;
        if (newMain && newSub) {
          newMain.currentTime = subState.currentTime;
          newMain.playbackRate = subState.playbackRate;
          newSub.currentTime = mainState.currentTime;
          newSub.playbackRate = mainState.playbackRate;
          if (!subState.paused) {
            void newMain.play();
          } else {
            newMain.pause();
          }
          if (!mainState.paused) {
            void newSub.play();
          } else {
            newSub.pause();
          }
        }
      }, 200);
    }
  };

  const handleMainVideoJump = (time: number) => {
    if (!mainVideoRef.current) {
      messageApi.warning("当前未播放视频");
      return;
    }
    mainVideoRef.current.currentTime = time;
  };

  const noSubVideo = !mutedPlayURL;
  const subVideoSizes = [0, 10, 20, 25, 33, 40, 50];

  const positionSubVideo = () => {
    const container = playerContainerRef.current;
    if (!container || !mutedPlayURL) {
      return;
    }

    const padding = 24;
    const containerWidth = container.clientWidth;
    const overlayWidth = (containerWidth * subVideoSize) / 100;
    const maxX = Math.max(padding, containerWidth - overlayWidth - padding);
    setSubVideoPos({ x: maxX, y: padding });
  };

  const hookVideoHandlers = (swap: boolean) => {
    const mainVideo = mainVideoRef.current;
    const subVideo = subVideoRef.current;
    if (!mainVideo || !subVideo) {
      return;
    }

    if (!swap) {
      subVideo.currentTime = mainVideo.currentTime;
      if (!mainVideo.paused) {
        void subVideo.play();
      }
    }

    subVideo.onplay = null;
    mainVideo.onplay = () => void subVideo?.play();

    subVideo.onpause = null;
    mainVideo.onpause = () => subVideo?.pause();

    subVideo.onratechange = null;
    mainVideo.onratechange = () => {
      if (subVideo && mainVideo) {
        subVideo.playbackRate = mainVideo.playbackRate;
      }
    };

    subVideo.onseeked = null;
    mainVideo.onseeked = () => {
      if (subVideo && mainVideo) {
        subVideo.currentTime = mainVideo.currentTime;
      }
    };
  };

  useEffect(() => {
    if (!noSubVideo && syncPlay) {
      hookVideoHandlers(false);
    }
  }, [playURLs, noSubVideo, syncPlay]);

  useEffect(() => {
    if (!noSubVideo && syncPlay) {
      hookVideoHandlers(true);
    }
  }, [mainPlayURL, noSubVideo, syncPlay]);

  useEffect(() => {
    if (!mutedPlayURL) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      positionSubVideo();
    });

    const handleResize = () => positionSubVideo();
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [mutedPlayURL, subVideoSize]);

  useEffect(() => {
    const fetchSubtitle = async () => {
      if (!selectedVideo || !mainPlayURL) {
        setSubtitleUrl(undefined);
        return;
      }
      try {
        const videoInfo = (await invoke("get_canvas_video_info", {
          videoId: selectedVideo.videoId,
        })) as VideoInfo;
        const srt = (await invoke("get_subtitle", {
          canvasCourseId: videoInfo.courId,
        })) as string;
        const vtt = srtToVtt(srt);
        const blob = new Blob([vtt], { type: "text/vtt" });
        const url = URL.createObjectURL(blob);
        setSubtitleUrl(url);
      } catch {
        setSubtitleUrl(undefined);
      }
    };
    void fetchSubtitle();
  }, [mainPlayURL, selectedVideo]);

  const selectedCourse = courses.data.find((course) =>
    course.id === selectedCourseId
  );

  return (
    <BasicLayout>
      {contextHolder}
      <Stack spacing={3}>
        <ClosableAlert
          alertType="info"
          message="提示"
          configKey={VIDEO_PAGE_HINT_ALERT_KEY}
          description="依次点击主屏幕和副屏幕的播放按钮即可开启双窗口模式。"
        />

        {loaded && notLogin ? (
          <Alert
            severity="info"
            sx={{ borderRadius: "8px" }}
            action={
              <Button component={RouterLink} to="/settings" color="inherit" size="small">
                前往设置
              </Button>
            }
          >
            视频功能依赖额外扫码登录。你可以前往设置页，在“额外扫码登录”区域完成登录后再回来使用。
          </Alert>
        ) : null}

        <Dialog
          open={showLoginRequiredDialog && loaded && notLogin}
          onClose={() => setShowLoginRequiredDialog(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>需要额外登录</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="body1">
                视频相关功能需要额外扫码登录后才能使用。
              </Typography>
              <Typography variant="body2" color="text.secondary">
                登录入口已经放到设置页，你可以在那里主动完成扫码并保存登录态。
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setShowLoginRequiredDialog(false)}>稍后再说</Button>
            <Button
              component={RouterLink}
              to="/settings"
              variant="contained"
              onClick={() => setShowLoginRequiredDialog(false)}
            >
              前往设置页
            </Button>
          </DialogActions>
        </Dialog>

        <WorkspaceHero
          chipLabel="视频管理"
          chipIcon={<SmartDisplayRoundedIcon />}
          title="视频中心"
          description="选择课程录像，下载视频、字幕、PPT，并支持双屏同步播放。"
          aside={
            !notLogin ? (
              <Box
                sx={{
                width: { xs: "100%", lg: 680 },
                alignSelf: { xs: "stretch", lg: "flex-start" },
                }}
              >
                <CourseSelect
                  courses={courses.data}
                  onChange={(courseId) => setSelectedCourseId(courseId)}
                  value={selectedCourseId > 0 ? selectedCourseId : undefined}
                />
              </Box>
            ) : undefined
          }
          stats={[
            {
              label: "课程视频",
              value: videos.length,
              icon: <VideoLibraryRoundedIcon />,
            },
            {
              label: "播放片段",
              value: plays.length,
              icon: <ClosedCaptionRoundedIcon />,
            },
            {
              label: "视频任务",
              value: videoDownloadTasks.length,
              icon: <CloudDownloadRoundedIcon />,
            },
            {
              label: "PPT 任务",
              value: pptDownloadTasks.length,
              icon: <PictureAsPdfRoundedIcon />,
            },
          ]}
          footer={
            <Stack spacing={1.5}>
              {!notLogin ? (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      xl: "minmax(0, 1.1fr) auto",
                    },
                    alignItems: "start",
                  }}
                >
                  <TextField
                    select
                    label="选择视频"
                    disabled={operating}
                    value={selectedVideo?.videoId ?? ""}
                    onChange={(event) =>
                      void handleSelectVideo(String(event.target.value))
                    }
                    helperText={
                      selectedVideo
                        ? `当前视频：${selectedVideo.videoName}`
                        : "选择一个课程后，这里会展示该课程的视频列表。"
                    }
                  >
                    {videos.map((video) => (
                      <MenuItem
                        key={video.videoId}
                        value={video.videoId}
                        disabled={!video.playable}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={1}
                          sx={{ width: "100%" }}
                        >
                          <Typography variant="body2" noWrap>
                            {`${video.videoName} ${video.courseBeginTime}`}
                          </Typography>
                          {!video.playable && (
                            <Chip
                              size="small"
                              label={video.availabilityLabel}
                              color={
                                video.availability === "repairing"
                                  ? "warning"
                                  : "default"
                              }
                              variant="outlined"
                              sx={{ flexShrink: 0 }}
                            />
                          )}
                        </Stack>
                      </MenuItem>
                    ))}
                  </TextField>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
                    <Button
                      variant="outlined"
                      startIcon={<ClosedCaptionRoundedIcon />}
                      onClick={() => void handleDownloadSubtitle()}
                      disabled={!selectedVideo}
                    >
                      下载字幕
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PictureAsPdfRoundedIcon />}
                      onClick={() =>
                        void handleDownloadPPT(
                          selectedVideo?.videoId || "",
                          `${selectedVideo?.videoName}.pdf`
                        )
                      }
                      disabled={!selectedVideo}
                    >
                      下载 PPT
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<PsychologyRoundedIcon />}
                      onClick={() => void handleSummarizeSubtitle()}
                      disabled={!selectedVideo}
                    >
                      AI 总结
                    </Button>
                  </Stack>
                </Box>
              ) : null}

              {selectedCourse ? (
                <Chip label={selectedCourse.name} color="primary" variant="outlined" />
              ) : null}
            </Stack>
          }
        />

        {!notLogin ? (
          <>
            <Card sx={surfaceCardSx}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      播放片段
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      主屏一般是黑板视角，录屏轨道可作为副屏或下载对象。
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: "divider",
                      overflow: "auto",
                    }}
                  >
                    <Table sx={{ minWidth: 720 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>视频名</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {plays.map((play) => (
                          <TableRow key={play.id} hover>
                            <TableCell>{play.name}</TableCell>
                            <TableCell align="right">
                              <Stack
                                direction="row"
                                spacing={1}
                                justifyContent="flex-end"
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleDownloadVideo(play)}
                                >
                                  下载
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => void handlePlay(play)}
                                >
                                  播放
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={surfaceCardSx}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      播放控制
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      可调节副屏尺寸、透明度，并在双轨播放时切换主副屏。
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={syncPlay}
                          onChange={(event) => setSyncPlay(event.target.checked)}
                          disabled={noSubVideo}
                        />
                      }
                      label="同步播放"
                    />
                    <Button
                      variant="outlined"
                      startIcon={<SwapHorizRoundedIcon />}
                      disabled={noSubVideo}
                      onClick={handleSwapVideo}
                    >
                      主副屏切换
                    </Button>
                    <TextField
                      select
                      label="副屏尺寸"
                      value={subVideoSize}
                      onChange={(event) => setSubVideoSize(Number(event.target.value))}
                      disabled={noSubVideo}
                      sx={{ width: { xs: "100%", md: 180 } }}
                    >
                      {subVideoSizes.map((size) => (
                        <MenuItem key={size} value={size}>
                          副屏：{size}%
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>

                  {!noSubVideo ? (
                    <Box sx={{ width: { xs: "100%", md: 360 } }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        副屏透明度
                      </Typography>
                      <Slider
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={subVideoOpacity}
                        onChange={(_, value) => setSubVideoOpacity(value as number)}
                      />
                    </Box>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={surfaceCardSx}>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    播放器
                  </Typography>
                  <Box
                    className={videoStyles.videoPlayerContainer}
                    sx={{
                      borderRadius: "8px",
                      overflow: "hidden",
                      bgcolor: "#000",
                    }}
                  >
                    <Box
                      ref={playerContainerRef}
                      sx={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "16 / 9",
                        minHeight: 360,
                        bgcolor: "#000",
                      }}
                    >
                      {mainPlayURL ? (
                        <video
                          ref={mainVideoRef}
                          controls
                          autoPlay
                          src={mainPlayURL}
                          muted={false}
                          onLoadStart={() => {
                            setPlaybackLoading(true);
                            setPlaybackError("");
                          }}
                          onCanPlay={() => void tryStartMainVideo()}
                          onPlaying={() => {
                            setPlaybackLoading(false);
                            setPlaybackError("");
                          }}
                          onLoadedMetadata={(event) => {
                            consoleLog(LOG_LEVEL_INFO, "Video metadata loaded", {
                              duration: event.currentTarget.duration,
                              width: event.currentTarget.videoWidth,
                              height: event.currentTarget.videoHeight,
                            });
                          }}
                          onWaiting={() => setPlaybackLoading(true)}
                          onError={handleMainVideoError}
                          width="100%"
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            objectFit: "contain",
                            background: "#000",
                          }}
                        >
                          {subtitleUrl ? (
                            <track
                              label="字幕"
                              kind="subtitles"
                              src={subtitleUrl}
                              srcLang="zh"
                              default
                            />
                          ) : null}
                        </video>
                      ) : (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "grid",
                            placeItems: "center",
                            color: "#fff",
                          }}
                        >
                          <Stack spacing={1.25} alignItems="center">
                            <VideoLibraryRoundedIcon sx={{ fontSize: 44, opacity: 0.8 }} />
                            <Typography variant="body1">选择片段后在这里开始播放</Typography>
                          </Stack>
                        </Box>
                      )}

                      {mainPlayURL && playbackLoading ? (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "grid",
                            placeItems: "center",
                            pointerEvents: "none",
                            bgcolor: "rgba(0, 0, 0, 0.2)",
                            zIndex: 2,
                          }}
                        >
                          <CircularProgress size={34} sx={{ color: "common.white" }} />
                        </Box>
                      ) : null}

                      {mainPlayURL && playbackError ? (
                        <Alert
                          severity="warning"
                          sx={{
                            position: "absolute",
                            left: 16,
                            right: 16,
                            bottom: 52,
                            zIndex: 3,
                          }}
                        >
                          {playbackError}
                        </Alert>
                      ) : null}

                      {!noSubVideo && mutedPlayURL ? (
                        <Draggable
                          bounds="parent"
                          position={subVideoPos}
                          onStop={(_: DraggableEvent, data: DraggableData) =>
                            setSubVideoPos({ x: data.x, y: data.y })
                          }
                          disabled={noSubVideo}
                        >
                          <div
                            style={{
                              position: "absolute",
                              zIndex: 1000,
                              opacity: subVideoOpacity,
                              pointerEvents: noSubVideo ? "none" : "auto",
                              width: `${subVideoSize}%`,
                              left: 0,
                              top: 0,
                              display: mutedPlayURL ? "block" : "block",
                              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                              borderRadius: 12,
                              background: "#000",
                              overflow: "hidden",
                            }}
                          >
                            <video
                              ref={subVideoRef}
                              controls
                              autoPlay
                              src={mutedPlayURL}
                              muted
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "block",
                                objectFit: "contain",
                                background: "#000",
                              }}
                            />
                          </div>
                        </Draggable>
                      ) : null}
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <VideoDownloadTable
              tasks={videoDownloadTasks}
              handleRemoveTask={handleRemoveTask}
            />
            <PPTDownloadTable
              tasks={pptDownloadTasks}
              handleRemoveTask={handleRemovePPTTask}
            />
          </>
        ) : null}

        <Card sx={surfaceCardSx}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                视频合并
              </Typography>
              <VideoAggregator />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <FileAIChatModal
        open={summaryChatOpen}
        title={summaryChatTitle}
        messages={summaryChatMessages}
        loading={summaryChatLoading}
        onClose={() => setSummaryChatOpen(false)}
        onSend={handleSendSummaryMessage}
        dialogTitle="AI 视频会话"
        dialogDescription="围绕当前视频字幕持续追问，AI 会结合字幕内容和时间点继续回答。"
        contextLabel="当前视频"
        emptyText="正在为当前视频创建第一条 AI 总结消息。"
        inputPlaceholder="继续追问这节课，例如：老师提到的作业要求是什么？考试范围出现在哪些时间点？"
        footerIdleText="提问会保留在当前会话中，后续回答会继续参考这段视频字幕。"
        markdownComponents={{ code: LinkRenderer as any }}
      />
    </BasicLayout>
  );
}
