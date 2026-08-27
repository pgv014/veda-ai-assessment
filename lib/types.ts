export type BBox={page:number;x:number;y:number;width:number;height:number};
export type Question={id:string;label:string;text:string;marks?:number;sourcePage:number};
export type Answer={id:string;label:string;text:string;regions:BBox[]};
export type Mapping={questionId:string;answerId:string|null;confidence:number;reason:string;marks:number;feedback:string};
