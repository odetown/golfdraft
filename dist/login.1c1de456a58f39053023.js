(window.webpackJsonp=window.webpackJsonp||[]).push([[2],{"0blL":function(e,t,a){},xAKJ:function(e,t,a){"use strict";Object.defineProperty(t,"__esModule",{value:!0}),a("+eM2"),a("fxB9"),a("0blL");const s=a("xsfh"),n=a("q1tI"),r=a("i8i4");const o=document.getElementById("golfdraftapp");var l;null===o?console.log("root node not found! golfdraftapp"):(l=o,r.render(n.createElement("div",{className:"container"},n.createElement("div",{className:"row"},n.createElement("div",{className:"col-md-offset-1 col-md-10"},n.createElement(s.default,{usernames:window.usernames})))),l))},xsfh:function(e,t,a){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const s=a("q1tI");function n(e){return!e||!(e.length&&e.length>0)}class r extends s.Component{constructor(e){super(e),this._onPasswordChange=e=>{this.setState({password:e.target.value})},this._onUserChange=e=>{this.setState({selectedUser:e.target.value})},this._onSubmit=()=>{this.setState({isSubmitted:!0,badAuth:!1})};const t=e.usernames.sort()[0];this.state={selectedUser:t,password:"",isSubmitted:!1,badAuth:!!new URLSearchParams(window.location.search).get("invalidAuth"),redirectTo:new URLSearchParams(window.location.search).get("redirect")}}componentDidMount(){this.refs.userSelect.focus()}render(){const{badAuth:e,isSubmitted:t,selectedUser:a,redirectTo:r,password:o}=this.state,l=t||n(o);return s.createElement("div",null,s.createElement("h2",null,"Who is you?"),e?s.createElement("div",{className:"alert alert-danger",role:"alert"},"Invalid password. Try again."):null,s.createElement("div",{className:"panel panel-default"},s.createElement("div",{className:"panel-body"},s.createElement("form",{role:"form",action:"/login",method:"post"},s.createElement("div",{className:"form-group"},s.createElement("select",{ref:"userSelect",id:"userSelect",name:"username",value:a,onChange:this._onUserChange,size:15,className:"form-control"},this.props.usernames.sort().map(e=>s.createElement("option",{key:e,value:e},e)))),s.createElement("div",{className:"form-group"+(e?" has-error":"")},s.createElement("input",{ref:"passwordInput",name:"password",type:"password",placeholder:"Password",className:"form-control",onChange:this._onPasswordChange,disabled:t,value:o})),n(r)?null:s.createElement("input",{type:"hidden",name:"redirect",value:r}),s.createElement("input",{type:"submit",className:"btn btn-default btn-primary",onSubmit:this._onSubmit,disabled:l,value:"Sign in"})))))}}t.default=r}},[["xAKJ",0,1]]]);