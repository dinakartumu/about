import React from 'react';
import './styles/Tools.css';
import Reactimage from './images/tools/reactjs.png';
import D3image from './images/tools/d3.png';
import Expressimage from './images/tools/express.png';
import Nodejsimage from './images/tools/nodejs.png';
import Webpackimage from './images/tools/webpack.svg';
import Mongodbimage from './images/tools/mongodb.svg';
import Toolsimage from './images/tools.svg';

const tools=[
    {
        name:"ReactJS",
        image:Reactimage
    },
    {
        name:"AngularJS",
        image:Toolsimage
    },
    {
        name:"NodeJS",
        image:Nodejsimage
    },
    {
        name:"HTML5",
        image:Toolsimage
    },
    {
        name:"CSS3",
        image:Toolsimage
    },
    {
        name:"Express",
        image:Expressimage
    },
    {
        name:"Webpack",
        image:Webpackimage
    },
    {
        name:"Mongodb",
        image:Mongodbimage
    },
    {
        name:'MySQL',
        image:Toolsimage
    },
    {
        name:'D3',
        image:D3image
    }
];

class Tools extends React.Component {
    render(){
        return(
            <div className='Tools'>
                <div className='Header'>
                    <h2>Tools</h2>
                </div>
                <div className='Body'>
                    {tools.map(eachtool=>
                        <div className='Eachtool'>
                            <div className='Toolimage'>
                                <img src={eachtool.image} alt=""/>
                            </div>
                            <div className='Toolname'>
                                <p>{eachtool.name}</p>
                            </div>
                        </div>
                    )}   
                </div>
            </div>
        )
    }
}

export default Tools;
