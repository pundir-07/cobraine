// import { Interaction } from "../../types";
// import { Interactions, UserInteraction,  } from "../../types/user";

// class StateMachine{
//     private userStates:Map<string,Interaction<>>
//     private _of:string|null= null
//     constructor(){
//         this.userStates = new Map<string,Interaction>()
//     }
//     of(userID:string){
//         if(!userID){
//             throw new Error("User ID cant be null/undefined")
//         }
//         this._of=userID
//     }
//     startInteraction(interaction:Interaction){
//         if(!this._of){
//             return
//         }
//         if(this.userStates.get(this._of)){
//             throw new Error("Previous user interaction in progress!")
//         }

//     }
//     enterState(state:Interactions[UserInteraction]){

//     }
//     reset(){

//     }
// }