import React, { Component } from 'react';
import './styles/App.css';
import Projects from './Projects.jsx';
import Tools from './Tools.jsx';
import Introduction from './Introduction.jsx';
import Footer from './Footer.jsx';

class App extends Component {
	render() {
		return (
			<div className='App'>
				<Introduction />
				<Tools />
				<Projects />
				<Footer />
			</div>
			
		);
	}
}

export default App;
