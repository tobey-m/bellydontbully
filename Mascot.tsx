import type { CSSProperties } from 'react';
export type MascotMood = 'deadpan' | 'sweet' | 'spicy' | 'explore' | 'save' | 'share' | 'sleep' | 'pocket' | 'pin';
const indexes: Record<MascotMood,number> = {deadpan:0,sweet:1,spicy:2,explore:3,save:4,share:5,sleep:6,pocket:7,pin:8};
export default function Mascot({mood='deadpan',size=48,label,className=''}:{mood?:MascotMood;size?:number;label?:string;className?:string}) {
 const n=indexes[mood]; const style:CSSProperties={width:size,height:size,backgroundImage:'url(/brand/mascots.webp)',backgroundSize:'300% 300%',backgroundPosition:`${(n%3)*50}% ${Math.floor(n/3)*50}%`};
 return <span role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} className={`belly-mascot ${className}`} style={style} />;
}
