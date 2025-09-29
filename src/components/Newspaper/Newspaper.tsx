import './Newspaper.css'

type NewspaperProps = {
    mainTitle?: string;
}

const Newspaper = ({ mainTitle }: NewspaperProps) => {
    return (
        <div className="newspaper-container">
            {/* Header Section */}
            <header className="newspaper-header">
                {/* Decorative Lines */}
                <div className="header-decorations">
                    <div className="decoration-left">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="decoration-line"></div>
                        ))}
                    </div>
                    {/* Main Title */}
                    <div className="title-section">
                        <h1 className="main-title">The Daily Obedience</h1>
                    </div>
                    <div className="decoration-right">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="decoration-line"></div>
                        ))}
                    </div>
                </div>



                {/* Date and Info */}
                <div className="date-info">
                    <span>November 24th, 1982</span>
                    <span>No Charge</span>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="content-grid">
                {/* Left Column */}
                <div className="left-column">
                    {/* Weather Section */}
                    <div className="weather-box">
                        <div className="box-header">
                            <h3>The Weather</h3>
                        </div>
                        <div className="box-content">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="content-line weather-line" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                            ))}
                        </div>
                    </div>

                    <div className="grestin-story">
                        <div className="story-content">
                            {[...Array(32)].map((_, i) => (
                                <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center Columns */}
                <div className="center-column">
                    {/* Main Headline */}
                    <div className="main-headline">
                        <h1>{mainTitle}</h1>
                        <p>Increased Trade And Cooperation Predicted</p>
                    </div>

                    {/* Article Columns */}
                    <div className="article-columns">
                        <div className="article-column">
                            {[...Array(25)].map((_, i) => (
                                <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                            ))}
                        </div>
                        <div className="article-column">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                            ))}
                            {/* Photo placeholder */}
                            <div className="photo-placeholder"></div>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                            ))}
                        </div>
                        <div className="article-column">
                            {[...Array(25)].map((_, i) => (
                                <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="right-column">
                    {/* Sports Section */}
                    <div className="sports-box">
                        <div className="box-header">
                            <h3>Sports</h3>
                        </div>
                        <div className="box-content">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                            ))}
                        </div>
                    </div>

                    {/* Additional Articles */}
                    <div className="additional-content">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="content-line" style={{ width: `${Math.random() * 30 + 70}%` }}></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Border */}
            <div className="bottom-border">
                <div className="bottom-decorations">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bottom-line"></div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Newspaper