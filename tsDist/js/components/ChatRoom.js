"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const moment = require("moment");
const React = require("react");
const Assets_1 = require("../constants/Assets");
const ChatActions_1 = require("../actions/ChatActions");
const GolfDraftPanel_1 = require("./GolfDraftPanel");
const UserStore_1 = require("../stores/UserStore");
const BOT_NAME = 'DraftBot';
const NAME_TAG_RE = /@[a-z]* *[a-z]*$/i;
const TAG_TO_NAME_RE = /~\[([^\]]+)\]/ig;
const SPECIFIC_TAG = "~[{{name}}]";
const ENTER_KEY = 13;
const DOWN_KEY = 40;
const UP_KEY = 38;
const newMessageSound = new Audio(Assets_1.default.NEW_CHAT_MESSAGE_SOUND);
class AutoComplete extends React.PureComponent {
    constructor(props) {
        super(props);
        this._onChange = (ev) => {
            this.setState({ selectedIndex: ev.currentTarget.selectedIndex });
        };
        this._onClick = (ev) => {
            this.forceSelect();
        };
        this._onKeyUp = (ev) => {
            if (ev.keyCode === ENTER_KEY) {
                this.forceSelect();
            }
        };
        this.state = { selectedIndex: 0 };
    }
    componentWillUpdate(nextProps, nextState) {
        const currentIndex = this.state.selectedIndex;
        const newIndex = nextState.selectedIndex;
        if (currentIndex !== newIndex) {
            return;
        }
        const oldChoices = this._getChoices();
        const newChoices = this._getChoices(nextProps);
        if (_.isEmpty(oldChoices) ||
            _.isEmpty(newChoices) ||
            !newChoices[currentIndex] ||
            oldChoices[currentIndex]._id !== newChoices[currentIndex]._id) {
            this.setState({ selectedIndex: 0 });
        }
    }
    render() {
        const choices = this._getChoices();
        if (_.isEmpty(choices)) {
            return null;
        }
        const selection = choices[this.state.selectedIndex].name;
        return (React.createElement("form", null,
            React.createElement("select", { ref: 'autocomplete', className: 'form-control', size: 3, value: selection, onChange: this._onChange, onClick: this._onClick, onKeyUp: this._onKeyUp }, _.map(choices, function (u) {
                return (React.createElement("option", { key: u._id, value: u.name }, u.name));
            }))));
    }
    forceSelect() {
        const choices = this._getChoices();
        this.props.onChoose({ value: choices[this.state.selectedIndex].name });
    }
    forceDown() {
        this._move(1);
    }
    forceUp() {
        this._move(-1);
    }
    _move(n) {
        const choices = this._getChoices();
        const currentIndex = this.state.selectedIndex;
        const newIndex = currentIndex + n;
        if (newIndex < 0 || newIndex >= choices.length) {
            return;
        }
        this.setState({ selectedIndex: newIndex });
    }
    _getChoices(props) {
        props = props || this.props;
        const text = props.text.toLowerCase();
        const choices = _.chain(props.allChoices)
            .filter(function (u) {
            return u.name.toLowerCase().startsWith(text);
        })
            .value();
        return choices;
    }
}
;
class ChatRoomInput extends React.PureComponent {
    constructor(props) {
        super(props);
        this._onKeyUp = (ev) => {
            if (this.state.taggingText) {
                if (ev.keyCode === UP_KEY) {
                    this._getNameTagger().forceUp();
                    ev.preventDefault();
                }
                else if (ev.keyCode === DOWN_KEY) {
                    this._getNameTagger().forceDown();
                    ev.preventDefault();
                }
            }
        };
        this._onUpdateText = (ev) => {
            const newText = ev.target.value;
            this.setState({
                text: newText,
                taggingText: newText.match(NAME_TAG_RE)
            });
        };
        this._onTag = (ev) => {
            const newText = this.state.text.replace(NAME_TAG_RE, "~[" + ev.value + "] ");
            this.setState({ text: newText, taggingText: null });
            this._focus();
        };
        this._onSend = (ev) => {
            ev.preventDefault();
            if (this.state.taggingText) {
                this._getNameTagger().forceSelect();
                return;
            }
            const text = this.state.text;
            if (_.isEmpty(text))
                return;
            ChatActions_1.default.createMessage(text);
            this.setState({ text: '', taggingText: null });
            this._focus();
        };
        this.state = { text: '', taggingText: null };
    }
    render() {
        const text = this.state.text;
        const nameTag = this.state.taggingText;
        return (React.createElement("div", null,
            React.createElement("form", { onSubmit: this._onSend },
                React.createElement("div", { className: 'form-group' },
                    React.createElement("input", { ref: 'input', className: 'form-control', value: text, onChange: this._onUpdateText, onKeyUp: this._onKeyUp }),
                    !nameTag ? null : (React.createElement(AutoComplete, { ref: 'nameTagger', allChoices: _.sortBy(UserStore_1.default.getAll(), 'name'), text: nameTag[0].substr(1), onChoose: this._onTag })),
                    React.createElement("button", { type: 'submit', className: 'btn btn-default' }, "Send")))));
    }
    _focus() {
        this.refs.input.focus();
    }
    _getNameTagger() {
        return this.refs.nameTagger;
    }
}
;
class Message extends React.PureComponent {
    render() {
        // Escape html BEFORE adding tags
        const text = _.escape(this.props.text);
        // Add tag html
        const htmlStr = text.replace(TAG_TO_NAME_RE, function (match, name) {
            const user = UserStore_1.default.getUserByName(name);
            if (!user) {
                return match;
            }
            else {
                return '<span class="user-tag label label-default">' + user.name + '</span>';
            }
        });
        return (React.createElement("span", { dangerouslySetInnerHTML: { __html: htmlStr } }));
    }
}
;
class ChatRoom extends React.PureComponent {
    componentDidMount() {
        this._forceScroll();
    }
    componentDidUpdate(prevProps) {
        // Don't process these until we have initially loaded messages
        if (!prevProps.messages) {
            if (this.props.messages) {
                this._forceScroll();
            }
            return;
        }
        const prevMessagesLength = prevProps.messages ? prevProps.messages.length : 0;
        const newMessagesLength = this.props.messages ? this.props.messages.length : 0;
        if (newMessagesLength > prevMessagesLength) {
            const myTagStr = SPECIFIC_TAG.replace("{{name}}", this.props.currentUser.name);
            const addedMessages = this.props.messages.slice(prevMessagesLength, newMessagesLength);
            const tagsMe = _.some(addedMessages, (msg) => {
                return msg.message.includes(myTagStr);
            });
            if (tagsMe) {
                newMessageSound.play();
            }
            this._forceScroll();
        }
    }
    render() {
        const messages = this.props.messages;
        let body = null;
        if (!messages) {
            body = (React.createElement("span", null, "Loading..."));
        }
        else if (_.isEmpty(messages)) {
            body = (React.createElement("span", null, "No messages. Be the first! Speak your mind."));
        }
        else {
            body = (React.createElement("dl", { className: 'chat-list dl-horizontal' }, _.map(messages, function (message, i) {
                const displayName = message.isBot ?
                    BOT_NAME : UserStore_1.default.getUser(message.user).name;
                const className = message.isBot ? 'bot-message' : '';
                return [
                    (React.createElement("dt", { key: 'dt' + i, className: className },
                        displayName,
                        " ",
                        React.createElement("span", { className: 'message-date' },
                            "(",
                            moment(message.date).calendar(),
                            ")"),
                        ":")),
                    (React.createElement("dd", { key: 'dd' + i, className: className },
                        React.createElement(Message, { text: message.message })))
                ];
            })));
        }
        return (React.createElement(GolfDraftPanel_1.default, { heading: 'Chat Room' },
            React.createElement("div", { className: 'row' },
                React.createElement("div", { className: 'col-md-9' },
                    React.createElement("div", { className: 'panel panel-default chat-panel', ref: 'chatPanel' },
                        React.createElement("div", { className: 'panel-body', ref: 'chatPanelBody' }, body)),
                    !messages ? null : (React.createElement(ChatRoomInput, null))),
                React.createElement("div", { className: 'col-md-3' },
                    React.createElement("div", { className: 'panel panel-default' },
                        React.createElement("div", { className: 'panel-body' },
                            React.createElement("b", null, "Online:"),
                            React.createElement("ul", { className: 'list-unstyled' }, _.chain(this.props.activeUsers)
                                .map((count, userId) => {
                                return UserStore_1.default.getUser(userId).name;
                            })
                                .sort()
                                .map((userName) => {
                                return (React.createElement("li", { key: userName }, userName));
                            })
                                .value())))))));
    }
    _forceScroll() {
        const refs = this.refs;
        refs.chatPanel.scrollTop = refs.chatPanelBody.offsetHeight;
    }
}
exports.default = ChatRoom;
;
