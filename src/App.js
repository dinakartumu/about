import React, { Component } from 'react';
import './styles/App.css';
import Projects from './Projects.jsx';
import Tools from './Tools.jsx';

class App extends Component {
	render() {
		return (
			<div className='App'>
				<Tools />
				<Projects />
			</div>
			
		);
	}
}

export default App;
