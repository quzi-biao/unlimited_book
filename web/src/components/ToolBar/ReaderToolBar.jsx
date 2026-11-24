import { useAppState } from '../../contexts/AppStateContext.jsx';
import { ToolBar } from './ToolBar.jsx';
import { TtsPlayer } from '../TtsPlayer/TtsPlayer.jsx';

/** 朗读入口固定在阅读栏右侧，控制条向上悬浮，不占用图片区域。 */
export function ReaderToolBar({ onSearch, safe, treePage, onTreeSpeech, tts, onGenerate, onToast, hidden, imageWidth }) {
  const { state, setCurrentPage } = useAppState();
  const pageTitle = state.bookFlat.find((page) => page.id === state.currentPageId)?.title || '';
  const togglePlayback = () => tts.togglePlayPause(state.currentPageId, state.currentBookTitle || '', pageTitle);
  return (
    <ToolBar
      onSearch={onSearch} safe={safe}
      imageWidth={imageWidth}
      onGenerate={onGenerate}
      onToast={onToast}
      hidden={hidden}
      playbackControl={
        <TtsPlayer
          pageVisible={!hidden}
          canStart={!!treePage || !!state.currentPageId}
          uiState={tts.uiState}
          onRoundClick={treePage ? onTreeSpeech : togglePlayback}
          onPlayPause={togglePlayback}
          onSeek={(sec) => tts.seekTo(sec)}
          onRateToggle={() => tts.toggleRate()}
          onGoToPage={(pageId) => {
            const page = state.bookFlat.find((item) => item.id === pageId);
            if (page) setCurrentPage(state.currentBookId, state.currentBookTitle, page.id, page.imageUrl);
          }}
        />
      }
    />
  );
}
