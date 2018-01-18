import * as _ from 'lodash';
import * as React from 'react';
import UserActions from '../actions/UserActions';
import {User} from '../types/Types';
import {Redirect} from 'react-router';

export interface LogoutButtonProps {
  currentUser: User;
}

interface LogoutButtonState {
  redirectTo?: string;
}

export default class LogoutButton extends React.Component<LogoutButtonProps, LogoutButtonState> {

  constructor(props) {
    super(props);
    this.state = this._getInitialState();
  }

  _getInitialState() {
    return { redirectTo: null };
  }

  render() {
    const {redirectTo} = this.state;
    if (redirectTo) {
      return (<Redirect to={redirectTo} />);
    }

    return (
        <a
          href="#noop"
          className="logout-button"
          onClick={this._onClick}
        >I&#8217;m not {this.props.currentUser.name}</a>
    );
  }

  _onClick = (ev) => {
    ev.preventDefault();
    UserActions.setCurrentUser(null);
    this.setState({ redirectTo: '/whoisyou' });
  }

};
