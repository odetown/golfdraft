'use strict';

import * as $ from 'jquery';
import * as _ from 'lodash';
import * as React from 'react';
const Redirect = require('react-router-dom').Redirect;
import UserActions from '../actions/UserActions';
import UserStore from '../stores/UserStore';

function getSortedUsers() {
  return _.sortBy(UserStore.getAll(), 'name');
}

class WhoIsYou extends React.Component {

  constructor(props) {
    super(props);
    this.state = this._getInitialState();
  }

  _getInitialState() {
    const selectedUser = getSortedUsers()[0]._id;
    return {
      selectedUser,
      password: '',
      isLoading: false,
      badAuth: false,
      redirectTo: null
    };
  }

  render() {
    const {badAuth, isLoading, password, selectedUser, redirectTo} = this.state;
    if (redirectTo) {
      return (<Redirect to={redirectTo} />);
    }

    const submitDisabled = !password || isLoading;
    return (
      <div>
        <h2>Who is you?</h2>
        {!badAuth ? null : (
          <div className='alert alert-danger' role='alert'>
            Invalid password. Try again.
          </div>
        )}
        <div className='panel panel-default'>
          <div className='panel-body'>
            <form role='form'>
              <div className='form-group'>
                <select
                  id='userSelect'
                  value={this.state.selectedUser}
                  onChange={this._onUserChange}
                  size='15'
                  className='form-control'
                >
                  {_.map(getSortedUsers(), function (u) {
                    return (<option key={u._id} value={u._id}>{u.name}</option>);
                  })}
                </select>
              </div>
              <div className={'form-group' + (badAuth ? ' has-error' : '')}>
                <input
                  ref='passwordInput'
                  id='password'
                  type='password'
                  className='form-control'
                  placeholder='password'
                  disabled={isLoading}
                  onChange={this._onPasswordChange}
                  value={password}
                />
              </div>
              <button
                className='btn btn-default btn-primary'
                onClick={this._onSubmit}
                disabled={submitDisabled}
              >
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  _onUserChange = (ev) => {
    this.setState({ selectedUser: ev.target.value });
  }

  _onPasswordChange = (ev) => {
    this.setState({ password: ev.target.value });
  }

  _onSubmit = (ev) => {
    ev.preventDefault();
    this.setState({ isLoading: true, badAuth: false });

    const xhr = $.post('/login', {
      username: UserStore.getUser(this.state.selectedUser).username,
      password: this.state.password
    });

    xhr.fail(function () {
      this.setState({ isLoading: false, badAuth: true, password: '' });
      this.refs.passwordInput.focus();
    }.bind(this));

    xhr.done(function () {
      UserActions.setCurrentUser(this.state.selectedUser);

      const locationState = this.props.location.state;
      const redirectTo = (locationState && locationState.from) || '/';
      this.setState({ redirectTo });
    }.bind(this));
  }

};

export default WhoIsYou;
