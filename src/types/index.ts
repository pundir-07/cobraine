import { Context } from "grammy";

export abstract class Interaction{
    constructor(readonly type:string){}
    data:any
    abstract initialise(context:Context):void
    abstract handle(context:Context):void
    abstract isFinished():boolean
}
