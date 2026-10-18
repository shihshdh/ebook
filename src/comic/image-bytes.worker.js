// 原生桥的大图 base64 在独立线程解码，结果转移所有权，避免主线程逐字节循环。
self.onmessage = ({ data: { id, data } }) => {
  try {
    const base64 = data.replace(/^data:[^,]*,/, '').replace(/\s/g, '');
    let bytes;
    if (typeof Uint8Array.fromBase64 === 'function') bytes = Uint8Array.fromBase64(base64);
    else {
      const binary = atob(base64); bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    }
    self.postMessage({ id, bytes: bytes.buffer }, [bytes.buffer]);
  } catch (error) { self.postMessage({ id, error: error?.message || String(error) }); }
};
