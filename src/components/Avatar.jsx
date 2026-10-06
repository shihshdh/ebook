// 账户头像：有照片用照片，没有就是书衣色圆底 + 名字第一个字（衬线、金色）
export default function Avatar({ account, size = 36, className = '' }) {
  if (!account) return null;
  const style = { width: size, height: size, fontSize: Math.round(size * .46), '--av': account.color || '#9a6f2a' };
  return (
    <span className={`avatar ${className}`} style={style} aria-hidden="true">
      {account.avatar ? <img src={account.avatar} alt="" /> : <span className="serif">{[...(account.name || '读')][0]}</span>}
    </span>
  );
}
