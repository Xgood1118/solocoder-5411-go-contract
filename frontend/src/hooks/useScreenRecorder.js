import { useState, useEffect, useRef, useCallback } from 'react'

const useScreenRecorder = (targetRef, options = {}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isPageHidden, setIsPageHidden] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  const {
    fps = 30,
    mimeType = 'video/webm;codecs=vp9',
    onPageHidden,
    onError,
  } = options

  const handleVisibilityChange = useCallback(() => {
    const hidden = document.hidden
    setIsPageHidden(hidden)
    if (hidden && onPageHidden) {
      onPageHidden()
    }
  }, [onPageHidden])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleVisibilityChange])

  const startRecording = useCallback(async () => {
    if (!targetRef?.current) {
      const error = new Error('目标元素不存在')
      if (onError) onError(error)
      return
    }

    try {
      const element = targetRef.current
      let stream

      if (element.captureStream) {
        stream = element.captureStream(fps)
      } else if (element.mozCaptureStream) {
        stream = element.mozCaptureStream(fps)
      } else {
        throw new Error('浏览器不支持 captureStream API')
      }

      streamRef.current = stream
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
      }

      mediaRecorder.onerror = (event) => {
        if (onError) {
          onError(event.error || new Error('录制出错'))
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordedBlob(null)
    } catch (error) {
      if (onError) {
        onError(error)
      }
    }
  }, [targetRef, fps, mimeType, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [isRecording])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isRecording])

  return {
    isRecording,
    isPageHidden,
    startRecording,
    stopRecording,
    recordedBlob,
  }
}

export default useScreenRecorder
